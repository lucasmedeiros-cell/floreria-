import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

/// Dominio del backend de easy pos, fijado al compilar. El usuario ya NO tipea
/// la URL del servidor: escanea/ingresa un código de pareo y el backend resuelve
/// a qué negocio pertenece. Por eso la dirección viene cableada en el binario.
///
///   flutter build appbundle --release --dart-define=EASYPOS_API=https://tu-dominio
///
/// En desarrollo, sin el define, apunta al backend local visto desde el
/// dispositivo (ver README: `adb reverse tcp:3005 tcp:3005` para un teléfono por
/// USB, o la IP del PC en la misma red).
const String _apiBaseCompilado = String.fromEnvironment(
  'EASYPOS_API',
  defaultValue: 'http://localhost:3005',
);

/// Servidor que trajo el QR de vinculación, si vino con uno. Cuando está, MANDA
/// sobre el dominio compilado: así el QR de Case decide a qué backend hablarle,
/// sin depender de recompilar la app por cada despliegue.
String _apiBaseOverride = '';

/// Base efectiva del backend: el servidor del QR si lo hubo, si no el compilado.
String get apiBase => _apiBaseOverride.isNotEmpty ? _apiBaseOverride : _apiBaseCompilado;

/// Lo que se extrae del QR de vinculación. El QR lo genera el panel (Case), así
/// que se acepta cualquiera de los formatos habituales sin acoplarse a uno:
///   · un TOKEN de dispositivo (48 hex): la app lo usa directo (X-Device-Token).
///   · un CÓDIGO de 6 dígitos: la app lo canjea por un token (/api/devices/pair).
///   · una URL `...://...?token=..&code=..` o JSON `{"token":..,"code":..}`:
///     se sacan los parámetros.
class QrPareo {
  final String? token;
  final String? code;
  /// Servidor al que debe hablarle la app, si el QR lo trae. Deja que Case
  /// apunte cada negocio a su backend sin recompilar.
  final String? server;
  const QrPareo({this.token, this.code, this.server});
  bool get vacio => (token == null || token!.isEmpty) && (code == null || code!.isEmpty);
}

String? _limpiarServer(String? s) {
  if (s == null) return null;
  var v = s.trim();
  if (v.isEmpty) return null;
  if (!v.contains('://')) v = 'https://$v';
  final u = Uri.tryParse(v);
  if (u == null || u.host.isEmpty) return null;
  return v.endsWith('/') ? v.substring(0, v.length - 1) : v;
}

final _reHexToken = RegExp(r'^[a-f0-9]{32,}$', caseSensitive: false);
final _reCodigo = RegExp(r'^\d{6}$');
final _reDigitos = RegExp(r'(\d{6})');

/// Interpreta el contenido de un QR de vinculación (ver [QrPareo]).
QrPareo parseQrPareo(String raw) {
  final s = raw.trim();
  if (s.isEmpty) return const QrPareo();

  // JSON con token/code/server.
  if (s.startsWith('{')) {
    try {
      final m = jsonDecode(s);
      if (m is Map) {
        return QrPareo(
          token: (m['token'] ?? m['deviceToken'])?.toString(),
          code: (m['code'] ?? m['codigo'])?.toString(),
          server: _limpiarServer(
              (m['server'] ?? m['url'] ?? m['api'] ?? m['backend'])?.toString()),
        );
      }
    } catch (_) {}
  }

  // URL. Puede traer el token/código como parámetro y, si es http(s), su propio
  // origen es el servidor (así el QR "https://backend/pair?token=.." apunta la
  // app a ese backend de una).
  if (s.contains('://')) {
    final uri = Uri.tryParse(s);
    if (uri != null) {
      final token = uri.queryParameters['token'] ?? uri.queryParameters['deviceToken'];
      final code = uri.queryParameters['code'] ?? uri.queryParameters['codigo'];
      final serverParam = uri.queryParameters['server'] ?? uri.queryParameters['api'];
      final serverFromOrigin = (uri.scheme == 'http' || uri.scheme == 'https')
          ? '${uri.scheme}://${uri.host}${uri.hasPort ? ':${uri.port}' : ''}'
          : null;
      if ((token != null && token.isNotEmpty) || (code != null && code.isNotEmpty)) {
        return QrPareo(
          token: token,
          code: code,
          server: _limpiarServer(serverParam ?? serverFromOrigin),
        );
      }
    }
  }

  // Token hex suelto.
  if (_reHexToken.hasMatch(s)) return QrPareo(token: s);
  // Código de 6 dígitos suelto.
  if (_reCodigo.hasMatch(s)) return QrPareo(code: s);
  // Último recurso: 6 dígitos en cualquier parte del texto.
  final m = _reDigitos.firstMatch(s);
  if (m != null) return QrPareo(code: m.group(1));

  return const QrPareo();
}

/// Lo que la app recuerda entre sesiones: el token de pareo (a qué negocio
/// pertenece) y, si el QR lo trajo, el servidor al que hablarle.
class Ajustes {
  static const _kDeviceToken = 'deviceToken';
  static const _kServer = 'apiServer';

  /// Token de pareo del dispositivo (48 hex). Se obtiene al canjear el código de
  /// 6 dígitos que da el CRM, y va en el header `X-Device-Token` de cada request
  /// para que el backend sepa el negocio (`lib/tenantRequest.ts`). Null = el
  /// dispositivo todavía no se pareó: la app muestra la pantalla de pareo.
  String? deviceToken;

  Ajustes({this.deviceToken});

  /// true = ya pareado. Es lo que decide si se muestra el pareo o el login.
  bool get pareado => deviceToken != null && deviceToken!.isNotEmpty;

  static Future<Ajustes> cargar() async {
    final prefs = await SharedPreferences.getInstance();
    // Restaurar el servidor del QR (si hubo) ANTES de cualquier request.
    _apiBaseOverride = prefs.getString(_kServer) ?? '';
    return Ajustes(deviceToken: prefs.getString(_kDeviceToken));
  }

  Future<void> guardarDeviceToken(String? token) async {
    deviceToken = token;
    final prefs = await SharedPreferences.getInstance();
    if (token == null || token.isEmpty) {
      await prefs.remove(_kDeviceToken);
    } else {
      await prefs.setString(_kDeviceToken, token);
    }
  }

  /// Fija el servidor del QR (o lo borra con null). Manda sobre el compilado.
  Future<void> guardarServer(String? server) async {
    _apiBaseOverride = server ?? '';
    final prefs = await SharedPreferences.getInstance();
    if (server == null || server.isEmpty) {
      await prefs.remove(_kServer);
    } else {
      await prefs.setString(_kServer, server);
    }
  }
}
