import 'dart:async';
import 'dart:convert';
import 'dart:io' show SocketException;
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'config.dart';
import 'device.dart';
import 'models.dart';
import 'nav.dart';
import 'theme.dart';

class ApiException implements Exception {
  final String message;

  /// Código HTTP si el error vino del backend (null = error local/de red).
  /// Lo usa la cola offline para decidir si un fallo es definitivo (400,
  /// venta inválida → descartar) o transitorio (5xx / sesión → conservar).
  final int? status;
  ApiException(this.message, {this.status});
  @override
  String toString() => message;
}

/// 404 del backend. Va separado porque para el escáner "no existe" NO es un
/// error: es la señal de que hay que dar de alta el producto.
class ApiNotFound extends ApiException {
  ApiNotFound(super.message) : super(status: 404);
}

/// 401 de PAREO: el token del dispositivo ya no vale (lo bloquearon, lo borraron
/// del panel, o quedó de un negocio que se limpió). NO es un problema de rol ni
/// de sesión: hay que volver a escanear un QR. La app, al verlo, olvida el token
/// y cae sola a la pantalla de vinculación.
class ApiDispositivoNoAutorizado extends ApiException {
  ApiDispositivoNoAutorizado(super.message) : super(status: 401);
}

/// Backend + pareo del dispositivo + sesión del empleado.
///
/// Tres identidades, en tres lugares distintos a propósito:
///   · **Dominio** (`config.dart`) — fijo, compilado en el binario.
///   · **Token de pareo** (`X-Device-Token`) — QUÉ negocio es. Se obtiene con el
///     código de 6 dígitos del CRM y se guarda en SharedPreferences.
///   · **Sesión del empleado** (`Authorization: Bearer`) — QUIÉN lo usa. Se
///     guarda CIFRADA en el keystore del dispositivo y, si el empleado lo activa,
///     detrás de la biometría.
class Api extends ChangeNotifier {
  static const _secure = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );
  static const _kSessionToken = 'session_token';
  static const _kBiometric = 'biometric_enabled';

  String? _token;
  String? name;
  String? email;
  String? phone;
  String? role;

  Ajustes ajustes = Ajustes();

  /// Nombre del negocio (marca) para el chrome del panel. Sale de `/api/business`.
  /// `negocioNameLight` es la parte inicial en tipografía fina ("Auto" de
  /// "AutoPartes"). Null hasta que se lee el negocio; el shell muestra "easy pos"
  /// como respaldo.
  String? negocioName;
  String? negocioNameLight;

  /// Módulos activos del negocio (qué secciones se ven en el CRM). Se configuran
  /// desde el panel (Case) y llegan en `/api/business`. Vacío = todavía no se
  /// leyó; el shell muestra el set por defecto hasta entonces.
  Map<String, bool> negocioModules = const {};

  /// Rubro del negocio (florería, repuestos, farmacia…). Define qué campos
  /// extra pide el formulario de productos. Vacío hasta que se lee el negocio.
  String negocioRubro = '';

  /// WhatsApp del negocio (para el atajo de recuperación de cuenta). Vacío si no
  /// está configurado.
  String negocioWhatsapp = '';

  /// Dirección del negocio (Configuración). Vacío si no está configurada.
  String negocioAddress = '';

  /// Logo propio del negocio (path/URL o data:). Vacío = se usa la inicial en
  /// una caja con el color de marca. Lo configura Configuración → Logo.
  String negocioLogo = '';

  /// ¿Está activo el módulo? Si no hay info del negocio todavía, se asume que sí
  /// (no esconder secciones antes de saber).
  bool moduloActivo(String id) => negocioModules[id] ?? true;

  /// true cuando loadSession() terminó (haya o no sesión). Lo usa el splash.
  bool ready = false;

  /// Hay una sesión guardada pero está detrás de la biometría y todavía no se
  /// desbloqueó. Mientras sea true, la app muestra la pantalla de bloqueo en vez
  /// del panel. El token existe pero no se activa hasta pasar la biometría.
  bool needsUnlock = false;
  String? _lockedToken;

  bool get loggedIn => _token != null;
  bool get pareado => ajustes.pareado;

  final LocalAuthentication _localAuth = LocalAuthentication();

  Map<String, String> _headers = const {'Content-Type': 'application/json'};

  Future<void> _refreshHeaders() async {
    _headers = {
      'Content-Type': 'application/json',
      ...await Dispositivo.headers(),
      if (_token != null) 'Authorization': 'Bearer $_token',
      if (ajustes.deviceToken != null) 'X-Device-Token': ajustes.deviceToken!,
    };
  }

  Future<void> loadSession() async {
    ajustes = await Ajustes.cargar();
    final prefs = await SharedPreferences.getInstance();
    final token = await _secure.read(key: _kSessionToken);
    final biometric = prefs.getBool(_kBiometric) ?? false;

    if (token != null && biometric) {
      // Sesión bajo llave: NO se activa hasta pasar la verificación. El chequeo
      // NO depende de que la biometría esté disponible ahora mismo: si el sensor
      // quedó inservible (huella borrada, bloqueo temporal), igual queda
      // bloqueada y el desbloqueo cae al PIN del teléfono (biometricOnly:false).
      // Si ni eso, el empleado entra con su contraseña — nunca de una.
      _lockedToken = token;
      needsUnlock = true;
      // El nombre/rol se cargan igual: la pantalla de bloqueo saluda por nombre.
      name = prefs.getString('name');
      role = prefs.getString('role');
    } else if (token != null) {
      _token = token;
      name = prefs.getString('name');
      email = prefs.getString('email');
      phone = prefs.getString('phone');
      role = prefs.getString('role');
    }
    await _refreshHeaders();

    if (_token != null) {
      try {
        final me = await _get('/api/auth/employee/me');
        if (me['user'] == null) {
          await logout();
        } else {
          name = me['user']['name'];
          role = me['user']['role'];
        }
      } catch (_) {
        // Sin red al abrir: se entra con lo guardado; la primera llamada real
        // dirá si el token ya no vale.
      }
    }
    ready = true;
    notifyListeners();
    // Restaurar el nombre/config del negocio al arrancar. Sin pareo también
    // funciona: en modo de un solo negocio /api/business responde directo.
    await refrescarColoresDelNegocio();
    // Ventas que quedaron sin subir (sin red): contarlas e intentar sincronizar.
    await _cargarPendientes();
    if (pendientesOffline > 0) sincronizarPendientes();
  }

  // ---------- Biometría ----------
  Future<bool> biometriaDisponible() async {
    try {
      return await _localAuth.isDeviceSupported() &&
          await _localAuth.canCheckBiometrics;
    } catch (_) {
      return false;
    }
  }

  bool get biometriaActivable => _token != null;

  Future<bool> biometriaActivada() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_kBiometric) ?? false;
  }

  /// Activa el reingreso por biometría. Pide la huella/rostro una vez para
  /// confirmar que funciona antes de dejarla como método de entrada.
  Future<bool> activarBiometria() async {
    if (!await biometriaDisponible()) return false;
    final ok = await _autenticar('Confirmá para activar el ingreso con biometría');
    if (!ok) return false;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kBiometric, true);
    notifyListeners();
    return true;
  }

  Future<void> desactivarBiometria() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kBiometric, false);
    notifyListeners();
  }

  /// Desbloquea la sesión guardada con la biometría. Si pasa, activa el token.
  Future<bool> desbloquear() async {
    if (!needsUnlock || _lockedToken == null) return false;
    final ok = await _autenticar('Ingresá a easy pos');
    if (!ok) return false;
    _token = _lockedToken;
    _lockedToken = null;
    needsUnlock = false;
    final prefs = await SharedPreferences.getInstance();
    name = prefs.getString('name');
    email = prefs.getString('email');
    phone = prefs.getString('phone');
    role = prefs.getString('role');
    await _refreshHeaders();
    notifyListeners();
    return true;
  }

  Future<bool> _autenticar(String motivo) async {
    try {
      return await _localAuth.authenticate(
        localizedReason: motivo,
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: false, // permite el PIN del teléfono como respaldo
        ),
      );
    } catch (_) {
      return false;
    }
  }

  // ---------- Datos del negocio ----------
  /// Lee la config del negocio para el nombre y los módulos (qué secciones se
  /// ven). Los COLORES NO se tocan: toda la app usa la paleta de easy pos
  /// (amarillo/negro), independientemente del rubro. Nunca tira: si falla, se
  /// queda con lo que haya.
  Future<void> refrescarColoresDelNegocio() async {
    try {
      final b = await _get('/api/business');
      negocioName = (b['name'] as String?)?.trim();
      negocioNameLight = (b['nameLight'] as String?)?.trim();
      final mods = b['modules'];
      if (mods is Map) {
        negocioModules = mods.map((k, v) => MapEntry(k.toString(), v == true));
      }
      negocioRubro = (b['rubroId'] as String?)?.trim() ?? '';
      negocioWhatsapp = (b['whatsapp'] as String?)?.trim() ?? '';
      negocioAddress = (b['address'] as String?)?.trim() ?? '';
      negocioLogo = (b['logoUrl'] as String?)?.trim() ?? '';
      // La app es siempre easy pos: por las dudas, se reafirma la paleta.
      applyPalette(AppPalette.easypos);
      notifyListeners();
    } catch (_) {
      // Sin red o negocio: se mantiene la paleta actual (easy pos).
    }
  }

  /// Lee la config completa del negocio (para la pantalla de Configuración).
  Future<Map<String, dynamic>> negocioConfig() async {
    final b = await _get('/api/business');
    return (b is Map) ? Map<String, dynamic>.from(b) : <String, dynamic>{};
  }

  /// Guarda datos del negocio (nombre, logo, WhatsApp, dirección…). Manda solo
  /// los campos presentes (POST parcial) y refresca la marca del chrome.
  Future<void> guardarNegocio({
    String? name,
    String? nameLight,
    String? logoUrl,
    String? whatsapp,
    String? address,
  }) async {
    await _post('/api/business', {
      if (name != null) 'name': name,
      if (nameLight != null) 'nameLight': nameLight,
      if (logoUrl != null) 'logoUrl': logoUrl,
      if (whatsapp != null) 'whatsapp': whatsapp,
      if (address != null) 'address': address,
    });
    await refrescarColoresDelNegocio();
  }

  // ---------- Empleados (equipo / Usuarios) ----------
  Future<List<Empleado>> empleados() async {
    final data = await _get('/api/employees');
    return (data as List).map((e) => Empleado.fromJson(e)).toList();
  }

  Future<Empleado> invitarEmpleado({
    required String name,
    required String phone,
    required String pass,
    String email = '',
    String role = 'Vendedora',
  }) async {
    final data = await _post('/api/employees', {
      'name': name,
      'phone': phone,
      'pass': pass,
      'email': email,
      'role': role,
    });
    return Empleado.fromJson(data);
  }

  Future<void> cambiarEstadoEmpleado(String id, bool active) async {
    await _patch('/api/employees/${Uri.encodeComponent(id)}', {'active': active});
  }

  // ---------- Pareo ----------
  /// Vincula el dispositivo a partir del contenido de un QR (lo genera el panel).
  /// Según lo que traiga el QR:
  ///   · token de dispositivo → se guarda directo (flujo multi-negocio de Case).
  ///   · código de 6 dígitos  → se canjea por un token (/api/devices/pair).
  /// Al terminar lee el negocio para el nombre y los módulos (los colores son
  /// siempre los de easy pos).
  Future<void> vincularConQr(String contenidoQr) async {
    final qr = parseQrPareo(contenidoQr);
    if (qr.vacio) {
      throw ApiException('El QR no es un código de vinculación válido.');
    }
    // Si el QR trae el servidor, se adopta ANTES de parear: el resto de las
    // llamadas ya salen a ese backend.
    if (qr.server != null && qr.server!.isNotEmpty) {
      await ajustes.guardarServer(qr.server);
    }
    try {
      if (qr.token != null && qr.token!.isNotEmpty) {
        await _guardarDeviceToken(qr.token!);
      } else {
        await parear(qr.code!);
      }
    } catch (e) {
      // Si el pareo falla, no dejar el servidor a medias.
      if (qr.server != null) await ajustes.guardarServer(null);
      // Un QR que trae su propio servidor y no se puede alcanzar es la causa
      // más común de "no hay conexión": el teléfono no llega a ESE servidor
      // (está apagado, es de otra red, o el equipo no tiene internet). Se lo
      // decimos con el servidor a la vista, no con un genérico.
      if (qr.server != null && qr.server!.isNotEmpty && _esErrorDeRed(e)) {
        throw ApiException(
            'No se pudo conectar al servidor del QR (${qr.server}). '
            'Verificá que el teléfono tenga acceso a ese servidor, o pedí un '
            'código en el panel e ingresalo a mano.');
      }
      rethrow;
    }
    // La sesión del empleado lleva estampado el NEGOCIO: si este QR era de otro
    // negocio (u otro servidor), el token de sesión viejo ya no vale y toda la
    // app respondería "No autorizado" sin explicación. Se verifica y, si la
    // sesión murió, se cierra acá para que aparezca el login limpio.
    if (_token != null) {
      try {
        final me = await _get('/api/auth/employee/me');
        if (me['user'] == null) await logout();
      } on ApiException catch (e) {
        if (e.status == 401 || e.status == 403) await logout();
      } catch (_) {
        // Sin red u otro error: se deja la sesión; la próxima llamada dirá.
      }
    }
  }

  /// ¿El error es una caída de red (vs. un rechazo del backend)? Sirve para
  /// distinguir "no llego al servidor" de "el servidor dijo que no".
  bool _esErrorDeRed(Object e) =>
      e is ApiException &&
      (e.message.contains('No hay conexión') || e.message.contains('no respondió'));

  /// Guarda un token de dispositivo ya emitido (viene en el QR) y adopta el
  /// negocio. Verifica contra el backend que el token sea válido antes de darlo
  /// por bueno, para no dejar la app "pareada" con un token que no sirve.
  Future<void> _guardarDeviceToken(String token) async {
    await ajustes.guardarDeviceToken(token);
    await _refreshHeaders();
    try {
      final me = await _get('/api/business'); // valida el token contra el negocio
      if (me is! Map) throw ApiException('Respuesta inesperada del servidor.');
    } catch (e) {
      // Token que el backend rechaza (401): se revierte para no quedar a medias.
      await ajustes.guardarDeviceToken(null);
      await _refreshHeaders();
      rethrow;
    }
    notifyListeners();
    await refrescarColoresDelNegocio();
  }

  /// Canjea el código de 6 dígitos del CRM por el token de dispositivo. Deja al
  /// dispositivo vinculado al negocio del código.
  Future<void> parear(String codigo) async {
    await _refreshHeaders(); // manda X-Device-* para registrar el equipo
    final data = await _post('/api/devices/pair', {'code': codigo.trim()});
    final token = data['token'] as String?;
    if (token == null || token.isEmpty) {
      throw ApiException('El servidor no devolvió un token de dispositivo.');
    }
    await ajustes.guardarDeviceToken(token);
    await _refreshHeaders();
    notifyListeners();
    // Ya vinculado al negocio: adoptar sus colores (fluido).
    await refrescarColoresDelNegocio();
  }

  /// Rompe el pareo (y cierra la sesión): el dispositivo vuelve a pedir código.
  Future<void> desparear() async {
    await logout();
    await ajustes.guardarDeviceToken(null);
    await ajustes.guardarServer(null);
    await _refreshHeaders();
    notifyListeners();
  }

  // ---------- Auth ----------
  /// Alta de cuenta: teléfono + contraseña, correo opcional.
  Future<void> registrar({
    required String name,
    required String phone,
    required String pass,
    String? email,
  }) async {
    final data = await _post('/api/auth/employee/register', {
      'name': name.trim(),
      'phone': phone.trim(),
      'pass': pass,
      if (email != null && email.trim().isNotEmpty) 'email': email.trim(),
    });
    await _guardarSesion(data);
  }

  /// Login. `identificador` es el teléfono (o el correo, para cuentas viejas).
  Future<void> login(String identificador, String pass) async {
    final data = await _post('/api/auth/employee/login', {
      'identifier': identificador.trim(),
      'pass': pass,
    });
    await _guardarSesion(data);
  }

  Future<void> _guardarSesion(Map<String, dynamic> data) async {
    _token = data['token'] as String?;
    name = data['name'] as String?;
    email = data['email'] as String?;
    phone = data['phone'] as String?;
    role = data['role'] as String?;
    await _secure.write(key: _kSessionToken, value: _token ?? '');
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('name', name ?? '');
    await prefs.setString('email', email ?? '');
    await prefs.setString('phone', phone ?? '');
    await prefs.setString('role', role ?? '');
    await _refreshHeaders();
    notifyListeners();
    await refrescarColoresDelNegocio();
  }

  Future<void> logout() async {
    _token = null;
    _lockedToken = null;
    needsUnlock = false;
    name = email = phone = role = null;
    await _secure.delete(key: _kSessionToken);
    final prefs = await SharedPreferences.getInstance();
    for (final k in ['name', 'email', 'phone', 'role', _kBiometric]) {
      await prefs.remove(k);
    }
    await _refreshHeaders();
    notifyListeners();
  }

  // ---------- HTTP ----------
  Uri _uri(String p) => Uri.parse('$apiBase$p');

  Future<dynamic> _get(String p) => _send((c) => c.get(_uri(p), headers: _headers));

  Future<dynamic> _post(String p, Object b) =>
      _send((c) => c.post(_uri(p), headers: _headers, body: jsonEncode(b)));

  Future<dynamic> _patch(String p, Object b) =>
      _send((c) => c.patch(_uri(p), headers: _headers, body: jsonEncode(b)));

  /// Un solo lugar para timeout, caída de red y errores del backend, de modo que
  /// el empleado vea siempre un motivo en castellano y no un stack.
  Future<dynamic> _send(Future<http.Response> Function(http.Client) call) async {
    final client = http.Client();
    try {
      final r = await call(client).timeout(const Duration(seconds: 20));
      return _decode(r);
    } on ApiDispositivoNoAutorizado {
      // El backend dice que este equipo ya no está autorizado: olvidamos el
      // token para que la app muestre la vinculación en vez de un críptico
      // "no autorizado" en cada pantalla.
      await _olvidarDispositivo();
      rethrow;
    } on TimeoutException {
      throw ApiException('El servidor no respondió. Revisá la conexión.');
    } on SocketException {
      throw ApiException('No hay conexión con el servidor.');
    } on http.ClientException catch (e) {
      throw ApiException('No hay conexión con el servidor. (${e.message})');
    } finally {
      client.close();
    }
  }

  dynamic _decode(http.Response r) {
    dynamic body;
    try {
      body = r.body.isEmpty ? {} : jsonDecode(r.body);
    } catch (_) {
      // 404 con cuerpo NO-JSON = la ruta no existe en ese backend (típico de un
      // servidor viejo/otro que no tiene el endpoint). Se marca como ApiNotFound
      // para que quien llama pueda dar un mensaje útil.
      if (r.statusCode == 404) throw ApiNotFound('404');
      throw ApiException(
        r.statusCode >= 400
            ? 'El servidor respondió ${r.statusCode}.'
            : 'Respuesta inesperada del servidor.',
      );
    }
    if (r.statusCode >= 200 && r.statusCode < 300) return body;
    final msg = (body is Map && body['error'] != null)
        ? body['error'].toString()
        : 'Error ${r.statusCode}';
    if (r.statusCode == 404) throw ApiNotFound(msg);
    // 401 de PAREO (no de sesión): el token del dispositivo dejó de valer.
    if (r.statusCode == 401) {
      final low = msg.toLowerCase();
      if (low.contains('dispositivo') || low.contains('parear') || low.contains('pareá')) {
        throw ApiDispositivoNoAutorizado(msg);
      }
    }
    throw ApiException(msg, status: r.statusCode);
  }

  /// Olvida el token del dispositivo (sin tocar la sesión del empleado) para que
  /// la app caiga a la pantalla de vinculación. Se usa cuando el backend
  /// responde que el equipo ya no está autorizado.
  Future<void> _olvidarDispositivo() async {
    await ajustes.guardarDeviceToken(null);
    negocioName = null;
    negocioNameLight = null;
    negocioLogo = '';
    notifyListeners();
    // Limpia las rutas pusheadas (historial, caja, formularios…) para que la
    // pantalla de vinculación quede realmente a la vista y no debajo.
    volverALaRaiz();
  }

  // ---------- Datos ----------
  Future<List<Order>> orders({String? status, String? q}) async {
    final params = <String, String>{};
    if (status != null) params['status'] = status;
    if (q != null && q.isNotEmpty) params['q'] = q;
    final qs = params.isEmpty
        ? ''
        : '?${params.entries.map((e) => '${e.key}=${Uri.encodeComponent(e.value)}').join('&')}';
    final data = await _get('/api/orders$qs');
    return (data as List).map((e) => Order.fromJson(e)).toList();
  }

  Future<void> setStatus(String code, String status) async {
    await _patch('/api/orders/$code', {'status': status});
  }

  Future<List<Client>> clients({String? q}) async {
    final qs = (q == null || q.isEmpty) ? '' : '?q=${Uri.encodeComponent(q)}';
    final data = await _get('/api/clients$qs');
    return (data as List).map((e) => Client.fromJson(e)).toList();
  }

  /// Lista de productos. Con `limit`/`offset` pagina (para catálogos grandes:
  /// se piden de a tandas y se cargan más al hacer scroll). `q` busca en el
  /// servidor (SKU, nombre, categoría, descripción).
  Future<List<Product>> products({String? q, int? limit, int? offset}) async {
    final params = <String, String>{
      if (q != null && q.isNotEmpty) 'q': q,
      if (limit != null) 'limit': '$limit',
      if (offset != null) 'offset': '$offset',
    };
    final qs = params.isEmpty
        ? ''
        : '?${params.entries.map((e) => '${e.key}=${Uri.encodeComponent(e.value)}').join('&')}';
    final data = await _get('/api/products$qs');
    return (data as List).map((e) => Product.fromJson(e)).toList();
  }

  /// Busca un producto por su CÓDIGO DE BARRAS físico (lo que devuelve el
  /// escáner). Devuelve null si no existe: no es un error, significa que hay que
  /// darlo de alta.
  Future<Product?> productByBarcode(String code) async {
    final c = code.trim();
    if (c.isEmpty) return null;
    try {
      final data = await _get('/api/products/barcode/${Uri.encodeComponent(c)}');
      return Product.fromJson(data);
    } on ApiNotFound {
      return null;
    }
  }

  /// Guarda una imagen y devuelve una referencia para ponerla en el producto/logo.
  ///
  /// Camino normal: la sube a `/api/uploads` y devuelve su URL (`/images/...`).
  /// Si ese endpoint **falla por cualquier motivo** (no existe → 404, error del
  /// servidor → 500, filesystem de solo lectura en serverless, timeout…), no
  /// rompe: incrusta la imagen como **data URI** (`data:image/...;base64,…`), que
  /// se guarda en el propio producto/negocio y la app pinta directo. Así subir
  /// fotos y el logo funciona contra cualquier backend.
  Future<String> subirImagen(Uint8List bytes, {String mime = 'image/jpeg'}) async {
    final b64 = base64Encode(bytes);
    try {
      final data = await _post('/api/uploads', {'mime': mime, 'data': b64});
      final url = data['url'] as String?;
      if (url != null && url.isNotEmpty) return url;
    } catch (_) {
      // Falla la subida (404, 500, FS de solo lectura…): se cae al data URI.
    }
    return 'data:$mime;base64,$b64';
  }

  /// Busca un producto por su código de barras en bases públicas para precargar
  /// el alta. Devuelve lo que se haya encontrado (puede venir casi vacío: un
  /// código NO contiene el nombre, solo un número; el nombre/foto salen de una
  /// base externa, y si nadie lo conoce solo se sabe el país del prefijo GS1).
  Future<BarcodeInfo> lookupBarcode(String code) async {
    final data = await _get('/api/products/lookup/${Uri.encodeComponent(code)}');
    return BarcodeInfo.fromJson(data as Map<String, dynamic>);
  }

  /// Alta de producto. `barcode` viaja tal cual lo leyó el escáner. `images` son
  /// los paths/URLs ya subidos; la primera es la principal.
  Future<Product> createProduct({
    required String id,
    required String name,
    required String category,
    int price = 0,
    int cost = 0,
    int stock = 0,
    String barcode = '',
    String desc = '',
    List<String> images = const [],
    Map<String, String> attributes = const {},
  }) async {
    final data = await _post('/api/products', {
      'id': id,
      'name': name,
      'category': category,
      'price': price,
      'cost': cost,
      'stock': stock,
      'barcode': barcode,
      'desc': desc,
      // `image` (la principal) además de `images`: un backend viejo que solo
      // tiene la columna `image` igual guarda la foto.
      'image': images.isNotEmpty ? images.first : '',
      'images': images,
      'attributes': attributes,
    });
    return Product.fromJson(data);
  }

  /// Actualiza solo los campos que se mandan (ingreso de mercadería: stock/costo).
  Future<Product> updateProduct(String id, Map<String, dynamic> patch) async {
    final data = await _patch('/api/products/${Uri.encodeComponent(id)}', patch);
    return Product.fromJson(data);
  }

  // ---------- Pedidos a proveedor ----------
  Future<List<PedidoProveedor>> pedidosProveedor() async {
    final data = await _get('/api/purchase-orders');
    return (data as List).map((e) => PedidoProveedor.fromJson(e)).toList();
  }

  /// Registra un pedido a proveedor (estado inicial 'solicitado'; el stock no
  /// cambia hasta recibirlo). Devuelve el código (COM-000123).
  Future<String> crearPedidoProveedor({
    required List<Map<String, dynamic>> items,
    String supplier = '',
    String notes = '',
  }) async {
    final data = await _post('/api/purchase-orders', {
      'supplier': supplier,
      'notes': notes,
      'items': items,
    });
    return data['code'] as String;
  }

  /// Cambia el estado de un pedido a proveedor. Al pasar a 'recibido', el
  /// backend sube el stock del inventario de cada ítem.
  Future<void> cambiarEstadoPedido(String id, String status) async {
    await _patch('/api/purchase-orders/${Uri.encodeComponent(id)}', {'status': status});
  }

  /// Registra una VENTA. `kind` = 'factura' (baja stock) o 'proforma' (no toca
  /// stock). `discountPct` = descuento total (0-100). Devuelve el código.
  Future<String> crearVenta({
    required String kind,
    required List<Map<String, dynamic>> items,
    String clientName = '',
    String clientPhone = '',
    String clientNit = '',
    String payMethod = 'Efectivo',
    double discountPct = 0,
    String notes = '',
  }) async {
    final payload = {
      'kind': kind,
      'clientName': clientName,
      'clientPhone': clientPhone,
      'clientNit': clientNit,
      'payMethod': payMethod,
      'discountPct': discountPct,
      'notes': notes,
      'items': items,
      // Clave de idempotencia: si este POST hace timeout pero el servidor SÍ lo
      // procesó, el reintento de la cola trae el mismo ref y el backend
      // devuelve la venta existente en vez de duplicarla.
      'clientRef': _nuevoRef(),
    };
    try {
      final data = await _post('/api/sales', payload);
      // Si había ventas encoladas, aprovechá que hay red y sincronizalas.
      if (pendientesOffline > 0) sincronizarPendientes();
      return data['code'] as String;
    } catch (e) {
      // Sin conexión: se guarda la venta localmente y se sincroniza después.
      // El mostrador puede seguir vendiendo aunque se caiga internet.
      if (_esErrorDeRed(e)) {
        final code = await _encolarVenta(payload);
        return code;
      }
      rethrow;
    }
  }

  // ---------- Ventas offline (cola local) ----------
  static const _kColaVentas = 'cola_ventas_offline';
  static const _kColaSeq = 'cola_ventas_seq';

  /// Ventas pendientes de sincronizar (guardadas sin conexión).
  int pendientesOffline = 0;

  /// Guard de reentrada: la sincronización se dispara desde varios lados
  /// (loadSession, crearVenta, el banner de Inicio); dos corridas a la vez
  /// duplicarían la primera venta de la cola.
  bool _sincronizando = false;

  String _nuevoRef() =>
      'app-${DateTime.now().microsecondsSinceEpoch}-${identityHashCode(this) & 0xFFFF}';

  Future<void> _cargarPendientes() async {
    final prefs = await SharedPreferences.getInstance();
    pendientesOffline = (prefs.getStringList(_kColaVentas) ?? const []).length;
    notifyListeners();
  }

  Future<String> _encolarVenta(Map<String, dynamic> payload) async {
    final prefs = await SharedPreferences.getInstance();
    final cola = prefs.getStringList(_kColaVentas) ?? <String>[];
    // Numeración persistente: con `cola.length + 1` dos tickets locales
    // distintos podían repetir código tras una sincronización parcial.
    final seq = (prefs.getInt(_kColaSeq) ?? 0) + 1;
    await prefs.setInt(_kColaSeq, seq);
    final code = 'OFFLINE-$seq';
    cola.add(jsonEncode({...payload, '_localCode': code}));
    await prefs.setStringList(_kColaVentas, cola);
    pendientesOffline = cola.length;
    notifyListeners();
    return code;
  }

  /// Reintenta subir las ventas encoladas. Devuelve cuántas se sincronizaron.
  /// Se detiene al primer fallo TRANSITORIO (sin red, servidor caído, sesión
  /// vencida) para conservar la cola; solo descarta una venta cuando el backend
  /// la rechaza como inválida (4xx de validación) — nunca por un 5xx/401/403,
  /// que mañana pueden funcionar: plata vendida no se borra por un error
  /// pasajero.
  Future<int> sincronizarPendientes() async {
    if (_sincronizando) return 0;
    _sincronizando = true;
    try {
      final prefs = await SharedPreferences.getInstance();
      final cola = prefs.getStringList(_kColaVentas) ?? <String>[];
      if (cola.isEmpty) return 0;
      var subidas = 0;
      while (cola.isNotEmpty) {
        final payload = jsonDecode(cola.first) as Map<String, dynamic>;
        payload.remove('_localCode');
        try {
          await _post('/api/sales', payload);
          cola.removeAt(0);
          subidas++;
          await prefs.setStringList(_kColaVentas, cola);
        } on ApiException catch (e) {
          final s = e.status;
          final invalida = s != null && s >= 400 && s < 500 && s != 401 && s != 403;
          if (!invalida) break; // transitorio: se reintenta en la próxima
          cola.removeAt(0); // el backend la rechazó de verdad: no trabar la cola
          await prefs.setStringList(_kColaVentas, cola);
        } catch (_) {
          break; // error de red u otro transitorio
        }
      }
      pendientesOffline = cola.length;
      notifyListeners();
      return subidas;
    } finally {
      _sincronizando = false;
    }
  }

  /// Historial de ventas (facturas y proformas recientes).
  Future<List<Venta>> ventas() async {
    final data = await _get('/api/sales');
    return (data as List).map((e) => Venta.fromJson(e)).toList();
  }

  /// Detalle de una venta con sus ítems (para reimprimir el comprobante).
  Future<VentaDetalle> ventaDetalle(String id) async {
    final data = await _get('/api/sales/${Uri.encodeComponent(id)}');
    return VentaDetalle.fromJson(data as Map<String, dynamic>);
  }

  /// Anula una venta. Si era factura, devuelve el stock.
  Future<void> anularVenta(String id) async {
    await _patch('/api/sales/${Uri.encodeComponent(id)}', {'void': true});
  }

  /// Resumen del turno actual para el arqueo de caja.
  Future<ResumenCaja> resumenCaja() async {
    final data = await _get('/api/cash');
    return ResumenCaja.fromJson(data as Map<String, dynamic>);
  }

  /// Cierra la caja (guarda el corte con el efectivo contado).
  Future<void> cerrarCaja({required double countedCash, String notes = ''}) async {
    await _post('/api/cash', {'countedCash': countedCash, 'notes': notes});
  }

  // ---------- Gastos ----------
  Future<List<Gasto>> gastos() async {
    final data = await _get('/api/expenses');
    return (data as List).map((e) => Gasto.fromJson(e)).toList();
  }

  Future<void> crearGasto({
    required double amount,
    String category = 'General',
    String description = '',
    String? spentAt,
  }) async {
    await _post('/api/expenses', {
      'amount': amount,
      'category': category,
      'description': description,
      if (spentAt != null) 'spentAt': spentAt,
    });
  }

  /// Ajuste manual de stock (merma, conteo físico, corrección). `delta` puede
  /// ser negativo. `reason` queda en el registro de movimientos.
  Future<int> ajustarStock(String productId, int delta, {String reason = ''}) async {
    final data = await _post(
        '/api/products/${Uri.encodeComponent(productId)}/adjust', {'delta': delta, 'reason': reason});
    return (data['stock'] as num?)?.toInt() ?? 0;
  }

  /// Resumen de ventas para Reportes (agregado en el servidor).
  Future<ReporteVentas> reporteVentas() async {
    final data = await _get('/api/reports');
    return ReporteVentas.fromJson(data as Map<String, dynamic>);
  }

  /// Genera un QR de cobro (BCP vía BaaS) por `amount` bolivianos. Devuelve la
  /// imagen (data-URI) y el correlativo/qrId para consultar el estado.
  Future<PagoQr> generarQrPago(double amount, {String gloss = 'Compra'}) async {
    final data = await _post('/api/payments/qr', {'amount': amount, 'gloss': gloss});
    return PagoQr(
      correlativo: (data['correlativo'] ?? '').toString(),
      qrId: data['qrId']?.toString(),
      qrImage: (data['qrImage'] ?? '').toString(),
      amount: (data['amount'] as num?)?.toDouble() ?? amount,
    );
  }

  /// Consulta si el QR ya fue pagado (polling desde el checkout).
  Future<bool> consultarPagoQr(String correlativo, {String? qrId}) async {
    final data = await _post('/api/payments/status', {
      'correlativo': correlativo,
      if (qrId != null) 'qrId': qrId,
    });
    return data['pagado'] == true;
  }

  /// Crea un pedido (canal CRM). Devuelve el código (PED-XXXX).
  Future<String> createOrder({
    required String clientName,
    required String phone,
    required String address,
    required List<Map<String, dynamic>> items,
    String priority = 'Media',
    String courier = 'Sin asignar',
    String payMethod = 'Efectivo',
    String? deliveryDate,
    String deliveryTime = '15:00',
    double deliveryCost = 20,
  }) async {
    final data = await _post('/api/orders', {
      'clientName': clientName,
      'phone': phone,
      'address': address,
      'priority': priority,
      'courier': courier,
      'payMethod': payMethod,
      if (deliveryDate != null) 'deliveryDate': deliveryDate,
      'deliveryTime': deliveryTime,
      'deliveryCost': deliveryCost,
      'items': items,
    });
    return data['code'] as String;
  }
}
