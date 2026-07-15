import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api.dart';
import '../theme.dart';
import '../widgets.dart';

/// Pantalla de bloqueo: hay una sesión guardada pero está detrás de la
/// biometría. Se muestra al abrir la app cuando el empleado activó el ingreso
/// biométrico. Al desbloquear, `Api` activa el token y el _Gate pasa al panel.
class LockScreen extends StatefulWidget {
  const LockScreen({super.key});
  @override
  State<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends State<LockScreen> {
  bool _trying = false;

  @override
  void initState() {
    super.initState();
    // Lanzar la biometría apenas aparece, sin que el usuario tenga que tocar.
    WidgetsBinding.instance.addPostFrameCallback((_) => _unlock());
  }

  Future<void> _unlock() async {
    if (_trying) return;
    setState(() => _trying = true);
    final ok = await context.read<Api>().desbloquear();
    if (!ok && mounted) setState(() => _trying = false);
  }

  @override
  Widget build(BuildContext context) {
    final api = context.read<Api>();
    return Scaffold(
      backgroundColor: EasyPos.ink,
      body: SafeArea(
        child: Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 64,
              height: 64,
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(borderRadius: BorderRadius.circular(18)),
              child: Image.asset(EasyPos.logo, fit: BoxFit.cover),
            ),
            const SizedBox(height: 22),
            Text('easy pos',
                style: AppText.serif(
                    size: 26, weight: FontWeight.w600, color: Colors.white)),
            const SizedBox(height: 6),
            Text(api.name == null ? 'Sesión bloqueada' : 'Hola, ${api.name}',
                style: AppText.sans(size: 13, color: Colors.white70)),
            const SizedBox(height: 34),
            _trying
                ? const CircularProgressIndicator(color: EasyPos.yellow)
                : Column(children: [
                    OutlineButton(
                      label: 'Desbloquear',
                      icon: Icons.fingerprint_rounded,
                      color: Colors.white,
                      onTap: _unlock,
                    ),
                    const SizedBox(height: 14),
                    GestureDetector(
                      onTap: () => api.logout(),
                      child: Text('Entrar con otra cuenta',
                          style: AppText.sans(size: 12.5, color: Colors.white54)),
                    ),
                  ]),
          ]),
        ),
      ),
    );
  }
}
