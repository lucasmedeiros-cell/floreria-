import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../api.dart';
import '../theme.dart';
import '../widgets.dart';
import 'recovery_screen.dart';
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
      showToast(context, 'Completá tu correo o teléfono y la contraseña.');
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
    return AuthSplitScaffold(children: [
      Center(
        child: Text('Iniciar sesión',
            style: AppText.serif(size: 26, weight: FontWeight.w600)),
      ),
      const SizedBox(height: 4),
      Center(
        child: Text('Ingresá con tu correo o teléfono y la contraseña.',
            textAlign: TextAlign.center,
            style: AppText.sans(size: 12.5, color: AppColors.ink2)),
      ),
      const SizedBox(height: 22),
      Field(
        controller: _id,
        hint: 'Correo o teléfono',
        icon: Icons.alternate_email_rounded,
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
        label: 'Ingresar',
        icon: Icons.login_rounded,
        expand: true,
        loading: _loading,
        onTap: _submit,
      ),
      const SizedBox(height: 14),
      Center(
        child: GestureDetector(
          onTap: () => Navigator.of(context)
              .push(MaterialPageRoute(builder: (_) => const RecoveryScreen())),
          child: Text('¿Olvidaste tu contraseña?',
              style: AppText.sans(size: 13, color: AppColors.ink2)),
        ),
      ),
      const SizedBox(height: 12),
      Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        Text('¿No tenés cuenta? ',
            style: AppText.sans(size: 13, color: AppColors.ink2)),
        GestureDetector(
          onTap: () => Navigator.of(context)
              .push(MaterialPageRoute(builder: (_) => const RegisterScreen())),
          child: Text('Crear una',
              style: AppText.sans(
                  size: 13, weight: FontWeight.w600, color: AppColors.accentDeep)),
        ),
      ]),
      const SizedBox(height: 14),
      const _ServerStatus(),
    ]);
  }
}

/// Marco visual compartido por Login y Vinculación: fondo "split" (panel oscuro
/// de marca a la izquierda, claro a la derecha) con una tarjeta blanca flotante.
/// Así las dos pantallas se ven idénticas.
class AuthSplitScaffold extends StatelessWidget {
  final List<Widget> children;
  const AuthSplitScaffold({super.key, required this.children});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(children: [
        Row(children: [
          Expanded(flex: 42, child: const PanelMarca()),
          const Expanded(flex: 58, child: ColoredBox(color: Colors.white)),
        ]),
        SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 400),
                child: Container(
                  padding: const EdgeInsets.fromLTRB(26, 30, 26, 26),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: kLiftShadow,
                    border: Border.all(color: AppColors.line),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: children,
                  ),
                ),
              ),
            ),
          ),
        ),
      ]),
    );
  }
}

/// Panel de marca (lado oscuro del login): gradiente casi-negro con el logo de
/// easy pos arriba, el tagline, y una marca de agua grande abajo.
class PanelMarca extends StatelessWidget {
  const PanelMarca({super.key});
  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(gradient: kDarkGradient),
      child: Stack(children: [
        // Glow amarillo sutil.
        Positioned(
          top: -60,
          left: -40,
          child: Container(
            width: 220,
            height: 220,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(colors: [
                EasyPos.yellow.withValues(alpha: .10),
                EasyPos.yellow.withValues(alpha: 0),
              ]),
            ),
          ),
        ),
        // Marca de agua grande del logo, abajo.
        Positioned(
          bottom: -30,
          right: -40,
          child: Opacity(
            opacity: .07,
            child: Image.asset(EasyPos.logo, width: 220, fit: BoxFit.contain),
          ),
        ),
        // Logo + tagline arriba.
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 22, 12, 16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              SizedBox(
                width: 56,
                height: 56,
                child: Image.asset(EasyPos.logo, fit: BoxFit.contain),
              ),
              const SizedBox(height: 12),
              RichText(
                text: TextSpan(
                  style: AppText.serif(size: 22, weight: FontWeight.w600, color: Colors.white),
                  children: const [
                    TextSpan(text: 'easy ', style: TextStyle(fontWeight: FontWeight.w400)),
                    TextSpan(text: 'pos', style: TextStyle(color: EasyPos.yellow)),
                  ],
                ),
              ),
              const SizedBox(height: 4),
              Text('PUNTO DE\nVENTA Y\nGESTIÓN',
                  style: AppText.eyebrow(size: 8.5, color: EasyPos.yellow)),
            ]),
          ),
        ),
      ]),
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

/// Estado del servidor en el login: prueba la conexión al abrir, deja re-probar
/// y cambiar la dirección del servidor. Así es fácil ver si el POS está conectado.
class _ServerStatus extends StatefulWidget {
  const _ServerStatus();
  @override
  State<_ServerStatus> createState() => _ServerStatusState();
}

class _ServerStatusState extends State<_ServerStatus> {
  static const _rojo = Color(0xFFE0324E);
  bool _testing = true;
  bool? _ok;
  String _msg = 'Probando conexión…';

  @override
  void initState() {
    super.initState();
    _test();
  }

  Future<void> _test() async {
    setState(() {
      _testing = true;
      _msg = 'Conectando con easy pos…';
    });
    // La app habla SIEMPRE con la nube de easy pos. Un solo chequeo de salud,
    // reintentable; sin escaneo de red WiFi (esto no es un servidor local).
    final r = await context.read<Api>().probarServidor();
    if (!mounted) return;
    setState(() {
      _testing = false;
      _ok = r.ok;
      _msg = r.ok
          ? 'Conectado a easy pos'
          : 'Sin conexión con easy pos. Revisá el internet del teléfono.';
    });
  }

  @override
  Widget build(BuildContext context) {
    final color =
        _testing ? AppColors.ink2 : (_ok == true ? AppColors.success : _rojo);
    final icon = _testing
        ? Icons.cloud_sync_rounded
        : (_ok == true ? Icons.cloud_done_rounded : Icons.cloud_off_rounded);
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
      decoration: BoxDecoration(
        color: AppColors.bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(children: [
        Icon(icon, size: 17, color: color),
        const SizedBox(width: 7),
        Expanded(
          child: Text(_msg,
              style: AppText.sans(size: 12.5, weight: FontWeight.w600, color: color)),
        ),
        if (!_testing && _ok != true)
          TextButton(
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            onPressed: _test,
            child: Text('Reintentar',
                style: AppText.sans(
                    size: 12.5, weight: FontWeight.w600, color: AppColors.accentDeep)),
          ),
      ]),
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
