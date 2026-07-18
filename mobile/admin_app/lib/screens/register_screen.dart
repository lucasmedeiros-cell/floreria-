import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../api.dart';
import '../nav.dart';
import '../theme.dart';
import '../widgets.dart';
import 'login_screen.dart';

/// Alta de cuenta desde la app: teléfono + contraseña. El correo es opcional.
/// El dispositivo ya está pareado, así que la cuenta se crea directamente en el
/// negocio de este dispositivo.
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});
  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _pass = TextEditingController();
  bool _loading = false;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _email.dispose();
    _pass.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_name.text.trim().isEmpty ||
        _phone.text.trim().isEmpty ||
        _pass.text.isEmpty) {
      showToast(context, 'Completá nombre, teléfono y contraseña.');
      return;
    }
    if (_pass.text.length < 6) {
      showToast(context, 'La contraseña necesita al menos 6 caracteres.');
      return;
    }
    setState(() => _loading = true);
    try {
      await context.read<Api>().registrar(
            name: _name.text,
            phone: _phone.text,
            pass: _pass.text,
            email: _email.text,
          );
      if (mounted) await ofrecerBiometria(context);
      // El _Gate solo cambia el `home`: hay que sacar ESTA pantalla pusheada
      // de encima para que el panel quede a la vista.
      volverALaRaiz();
    } catch (e) {
      if (mounted) showToast(context, e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: 'Crear cuenta',
      subtitle: 'Con tu teléfono y una contraseña. El correo es opcional.',
      children: [
        Field(controller: _name, hint: 'Nombre', icon: Icons.person_outline_rounded),
        const SizedBox(height: 14),
        Field(
          controller: _phone,
          hint: 'Teléfono',
          icon: Icons.phone_outlined,
          keyboard: TextInputType.phone,
        ),
        const SizedBox(height: 14),
        Field(
          controller: _email,
          hint: 'Correo (opcional)',
          icon: Icons.mail_outline_rounded,
          keyboard: TextInputType.emailAddress,
        ),
        const SizedBox(height: 14),
        Field(
          controller: _pass,
          hint: 'Contraseña',
          icon: Icons.lock_outline_rounded,
          obscure: true,
        ),
        const SizedBox(height: 22),
        PrimaryButton(
          label: 'Crear cuenta',
          icon: Icons.person_add_alt_1_rounded,
          expand: true,
          loading: _loading,
          onTap: _submit,
        ),
        const SizedBox(height: 16),
        Center(
          child: GestureDetector(
            onTap: () => Navigator.of(context).pop(),
            child: Text('Ya tengo cuenta',
                style: AppText.sans(
                    size: 13, weight: FontWeight.w600, color: AppColors.rose)),
          ),
        ),
      ],
    );
  }
}
