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

class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  @override
  String toString() => message;
}

/// 404 del backend. Va separado porque para el escáner "no existe" NO es un
/// error: es la señal de que hay que dar de alta el producto.
class ApiNotFound extends ApiException {
  ApiNotFound(super.message);
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

    if (token != null && biometric && await biometriaDisponible()) {
      // Sesión bajo llave: no se activa hasta pasar la biometría.
      _lockedToken = token;
      needsUnlock = true;
    } else if (token != null) {
      _token = token;
      name = prefs.getString('name');
      email = prefs.getString('email');
      phone = prefs.getString('phone');
      role = prefs.getString('role');
    }
    await _refreshHeaders();

    if (_token != null && ajustes.pareado) {
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

  // ---------- Pareo ----------
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
  }

  /// Rompe el pareo (y cierra la sesión): el dispositivo vuelve a pedir código.
  Future<void> desparear() async {
    await logout();
    await ajustes.guardarDeviceToken(null);
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
    throw ApiException(msg);
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

  Future<List<Product>> products({String? q}) async {
    final qs = (q == null || q.isEmpty) ? '' : '?q=${Uri.encodeComponent(q)}';
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

  /// Alta de producto. `barcode` viaja tal cual lo leyó el escáner.
  Future<Product> createProduct({
    required String id,
    required String name,
    required String category,
    int price = 0,
    int cost = 0,
    int stock = 0,
    String barcode = '',
    String desc = '',
    String image = '',
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
      'image': image,
    });
    return Product.fromJson(data);
  }

  /// Actualiza solo los campos que se mandan (ingreso de mercadería: stock/costo).
  Future<Product> updateProduct(String id, Map<String, dynamic> patch) async {
    final data = await _patch('/api/products/${Uri.encodeComponent(id)}', patch);
    return Product.fromJson(data);
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
