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
const String apiBase = String.fromEnvironment(
  'EASYPOS_API',
  defaultValue: 'http://localhost:3005',
);

/// Lo que la app recuerda entre sesiones. Ya no incluye el servidor (es fijo):
/// solo el token de pareo, que dice a qué negocio pertenece este dispositivo.
class Ajustes {
  static const _kDeviceToken = 'deviceToken';

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
}
