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
        title: Text('Ingresar código',
            style: AppText.serif(size: 20, weight: FontWeight.w600)),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          keyboardType: TextInputType.number,
          maxLength: 6,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          textAlign: TextAlign.center,
          style: AppText.serif(size: 30, weight: FontWeight.w700, color: AppColors.ink)
              .copyWith(letterSpacing: 8),
          decoration: const InputDecoration(counterText: '', hintText: '••••••'),
          onSubmitted: (v) => Navigator.of(ctx).pop(v.trim()),
        ),
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
    return AuthScaffold(
      title: 'Vinculá este dispositivo',
      subtitle:
          'Escaneá el código QR que aparece en el panel de easy pos '
          '(Configuración → Vincular dispositivo).',
      children: [
        PrimaryButton(
          label: 'Escanear código QR',
          icon: Icons.qr_code_scanner_rounded,
          expand: true,
          loading: _procesando,
          onTap: _escanearQr,
        ),
        const SizedBox(height: 14),
        Center(
          child: GestureDetector(
            onTap: _procesando ? null : _codigoManual,
            child: Text('El QR no se lee — ingresar código a mano',
                style: AppText.sans(
                    size: 13, weight: FontWeight.w600, color: AppColors.rose)),
          ),
        ),
      ],
    );
  }
}
