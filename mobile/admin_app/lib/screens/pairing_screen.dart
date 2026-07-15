import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../api.dart';
import '../theme.dart';
import '../widgets.dart';
import 'login_screen.dart';

/// Primer inicio: el dispositivo todavía no pertenece a ningún negocio. El
/// empleado (o el dueño) pide un código de 6 dígitos en el CRM
/// (Configuración → Vincular dispositivo) y lo ingresa acá. Al canjearlo, el
/// dispositivo queda pareado y ya no se vuelve a ver esta pantalla.
class PairingScreen extends StatefulWidget {
  const PairingScreen({super.key});
  @override
  State<PairingScreen> createState() => _PairingScreenState();
}

class _PairingScreenState extends State<PairingScreen> {
  final _code = TextEditingController();
  bool _loading = false;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final code = _code.text.trim();
    if (code.length != 6) {
      showToast(context, 'El código tiene 6 dígitos.');
      return;
    }
    setState(() => _loading = true);
    try {
      await context.read<Api>().parear(code);
      // Al parear, el _Gate de main.dart pasa solo a la pantalla de login.
    } catch (e) {
      if (mounted) showToast(context, e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: 'Vinculá este dispositivo',
      subtitle:
          'Pedí el código en el CRM: Configuración → Vincular dispositivo. '
          'Vence a los 15 minutos.',
      children: [
        TextField(
          controller: _code,
          autofocus: true,
          keyboardType: TextInputType.number,
          textAlign: TextAlign.center,
          maxLength: 6,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          style: AppText.serif(
              size: 40, weight: FontWeight.w700, color: AppColors.ink)
            .copyWith(letterSpacing: 12),
          decoration: InputDecoration(
            counterText: '',
            hintText: '••••••',
            hintStyle: AppText.serif(size: 40, color: AppColors.faint)
                .copyWith(letterSpacing: 12),
            filled: true,
            fillColor: AppColors.surface2,
            contentPadding: const EdgeInsets.symmetric(vertical: 14),
            enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: AppColors.line)),
            focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: AppColors.rose, width: 1.5)),
          ),
          onSubmitted: (_) => _submit(),
        ),
        const SizedBox(height: 20),
        PrimaryButton(
          label: 'Vincular',
          icon: Icons.link_rounded,
          expand: true,
          loading: _loading,
          onTap: _submit,
        ),
      ],
    );
  }
}
