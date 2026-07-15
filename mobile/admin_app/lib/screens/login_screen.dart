import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../api.dart';
import '../theme.dart';
import '../widgets.dart';
import 'register_screen.dart';

/// Login del empleado: teléfono + contraseña (el correo sirve solo para cuentas
/// viejas). El dispositivo ya está pareado a un negocio, así que acá no se pide
/// servidor ni código: solo quién entra.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _id = TextEditingController();
  final _pass = TextEditingController();
  bool _loading = false;

  @override
  void dispose() {
    _id.dispose();
    _pass.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_id.text.trim().isEmpty || _pass.text.isEmpty) {
      showToast(context, 'Completá teléfono y contraseña.');
      return;
    }
    setState(() => _loading = true);
    try {
      await context.read<Api>().login(_id.text, _pass.text);
      // Al entrar, ofrecer activar la biometría para la próxima vez.
      if (mounted) await ofrecerBiometria(context);
    } catch (e) {
      if (mounted) showToast(context, e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: 'Iniciar sesión',
      subtitle: 'Ingresá con tu teléfono y contraseña.',
      children: [
        Field(
          controller: _id,
          hint: 'Teléfono',
          icon: Icons.phone_outlined,
          keyboard: TextInputType.phone,
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
          label: 'Ingresar',
          icon: Icons.login_rounded,
          expand: true,
          loading: _loading,
          onTap: _submit,
        ),
        const SizedBox(height: 18),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Text('¿No tenés cuenta? ',
              style: AppText.sans(size: 13, color: AppColors.ink2)),
          GestureDetector(
            onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const RegisterScreen())),
            child: Text('Crear una',
                style: AppText.sans(
                    size: 13, weight: FontWeight.w600, color: AppColors.rose)),
          ),
        ]),
      ],
    );
  }
}

/// Tras un login/alta exitosos, si el equipo tiene biometría, ofrece activarla.
/// Se muestra una sola vez por login; si el usuario dice que no, sigue de largo.
Future<void> ofrecerBiometria(BuildContext context) async {
  final api = context.read<Api>();
  if (!await api.biometriaDisponible()) return;
  if (await api.biometriaActivada()) return;
  if (!context.mounted) return;

  final quiere = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: AppColors.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Text('Entrar más rápido',
          style: AppText.serif(size: 22, weight: FontWeight.w600)),
      content: Text(
        'Activá el ingreso con tu huella o rostro para la próxima vez, sin '
        'volver a escribir la contraseña.',
        style: AppText.sans(size: 13.5, color: AppColors.ink2),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: Text('Ahora no',
              style: AppText.sans(size: 13, color: AppColors.ink2)),
        ),
        TextButton(
          onPressed: () => Navigator.pop(ctx, true),
          child: Text('Activar',
              style: AppText.sans(
                  size: 13, weight: FontWeight.w600, color: AppColors.rose)),
        ),
      ],
    ),
  );
  if (quiere == true) await api.activarBiometria();
}

/// Marco compartido por las pantallas de auth (pareo, login, alta): fondo cálido,
/// hero de marca easy pos y la tarjeta con los campos.
class AuthScaffold extends StatelessWidget {
  final String title, subtitle;
  final List<Widget> children;
  final Widget? leading;
  const AuthScaffold({
    super.key,
    required this.title,
    required this.subtitle,
    required this.children,
    this.leading,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: DecoratedBox(
        decoration: const BoxDecoration(gradient: kPageBackground),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 28),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Container(
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(28),
                    boxShadow: kLiftShadow,
                    border: Border.all(color: AppColors.line),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const _Hero(),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(26, 24, 26, 26),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            if (leading != null) leading!,
                            Text(title,
                                style: AppText.serif(
                                    size: 26, weight: FontWeight.w600)),
                            const SizedBox(height: 4),
                            Text(subtitle,
                                style: AppText.sans(
                                    size: 13, color: AppColors.ink2)),
                            const SizedBox(height: 22),
                            ...children,
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero();
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(26, 28, 26, 24),
      decoration: const BoxDecoration(gradient: kDarkGradient),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 52,
          height: 52,
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(15),
            boxShadow: [
              BoxShadow(
                  color: EasyPos.yellow.withValues(alpha: .35),
                  blurRadius: 16,
                  offset: const Offset(0, 6)),
            ],
          ),
          child: Image.asset(EasyPos.logo, fit: BoxFit.cover),
        ),
        const SizedBox(height: 14),
        RichText(
          text: TextSpan(
            style:
                AppText.serif(size: 28, weight: FontWeight.w600, color: Colors.white),
            children: const [
              TextSpan(text: 'easy ', style: TextStyle(fontWeight: FontWeight.w400)),
              TextSpan(text: 'pos', style: TextStyle(color: EasyPos.yellow)),
            ],
          ),
        ),
        const SizedBox(height: 3),
        Text(EasyPos.tagline, style: AppText.eyebrow(size: 9.5, color: EasyPos.yellow)),
      ]),
    );
  }
}
