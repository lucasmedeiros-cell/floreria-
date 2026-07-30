import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../api.dart';
import '../theme.dart';
import '../widgets.dart';
import 'login_screen.dart';
import 'qr_scan_screen.dart';

/// Primer inicio: el dispositivo todavía no pertenece a ningún negocio. La forma
/// principal de vincularlo es **escanear el QR** que muestra el panel (Case); al
/// leerlo, el dispositivo queda pareado y la app adopta los colores y módulos
/// del negocio. Como respaldo (QR ilegible), se puede ingresar el código a mano.
class PairingScreen extends StatefulWidget {
  const PairingScreen({super.key});
  @override
  State<PairingScreen> createState() => _PairingScreenState();
}

class _PairingScreenState extends State<PairingScreen> {
  bool _procesando = false;

  Future<void> _escanearQr() async {
    final contenido = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const QrScanScreen()),
    );
    if (contenido == null || !mounted) return;
    await _vincular(() => context.read<Api>().vincularConQr(contenido));
  }

  Future<void> _codigoManual() async {
    final code = await _pedirCodigo();
    if (code == null || !mounted) return;
    await _vincular(() => context.read<Api>().parear(code));
  }

  Future<void> _vincular(Future<void> Function() accion) async {
    setState(() => _procesando = true);
    try {
      await accion();
      // Al vincular, el _Gate pasa solo a la pantalla de login.
    } catch (e) {
      if (mounted) showToast(context, e.toString());
    } finally {
      if (mounted) setState(() => _procesando = false);
    }
  }

  Future<String?> _pedirCodigo() {
    final ctrl = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Código del panel',
            style: AppText.serif(size: 20, weight: FontWeight.w600)),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          Text('El código de 4 dígitos que aparece junto al QR, en la sección Vinculación QR.',
              style: AppText.sans(size: 12.5, color: AppColors.ink2)),
          const SizedBox(height: 14),
          TextField(
            controller: ctrl,
            autofocus: true,
            keyboardType: TextInputType.number,
            maxLength: 4,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            textAlign: TextAlign.center,
            style: AppText.serif(size: 34, weight: FontWeight.w700, color: AppColors.ink)
                .copyWith(letterSpacing: 12),
            decoration: const InputDecoration(counterText: '', hintText: '••••'),
            onSubmitted: (v) => Navigator.of(ctx).pop(v.trim()),
          ),
        ]),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text('Cancelar', style: AppText.sans(size: 13, color: AppColors.ink2)),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(ctrl.text.trim()),
            child: Text('Vincular',
                style: AppText.sans(size: 13, weight: FontWeight.w600, color: AppColors.rose)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Mismo marco que el login (fondo split + tarjeta blanca flotante).
    return AuthSplitScaffold(children: [
      Center(
        child: Text('Vinculá este equipo',
            style: AppText.serif(size: 26, weight: FontWeight.w600)),
      ),
      const SizedBox(height: 4),
      Center(
        child: Text(
          'Primero conectá el equipo a tu negocio. El código lo genera el panel '
          'de easy pos, en la sección Vinculación QR.',
          textAlign: TextAlign.center,
          style: AppText.sans(size: 12.5, color: AppColors.ink2),
        ),
      ),
      const SizedBox(height: 22),
      // Ilustración: marco de visor easy pos con el ícono de QR adentro.
      Center(
        child: Container(
          width: 128,
          height: 128,
          decoration: BoxDecoration(
            color: EasyPos.yellow.withValues(alpha: .10),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: EasyPos.yellow.withValues(alpha: .35), width: 1.5),
          ),
          child: Icon(Icons.qr_code_2_rounded,
              size: 76, color: AppColors.ink.withValues(alpha: .8)),
        ),
      ),
      const SizedBox(height: 22),
      PrimaryButton(
        label: 'Escanear código QR',
        icon: Icons.qr_code_scanner_rounded,
        expand: true,
        loading: _procesando,
        onTap: _escanearQr,
      ),
      const SizedBox(height: 12),
      // Botón secundario para el código de 4 dígitos (cuando el QR no se lee).
      SizedBox(
        width: double.infinity,
        child: OutlinedButton.icon(
          onPressed: _procesando ? null : _codigoManual,
          icon: const Icon(Icons.dialpad_rounded, size: 18),
          label: const Text('Escribir código de 4 dígitos'),
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.ink,
            side: BorderSide(color: AppColors.line),
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            textStyle: AppText.sans(size: 14, weight: FontWeight.w600),
          ),
        ),
      ),
      const SizedBox(height: 16),
      Center(
        child: Text('Después de vincular vas a iniciar sesión con tu usuario.',
            textAlign: TextAlign.center,
            style: AppText.sans(size: 12.5, color: AppColors.ink2)),
      ),
    ]);
  }
}
