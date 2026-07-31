import { execFile } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { query } from "./db";

/**
 * Puente al PLAN de Claude — la IA del Vendedor 24/7 sin crédito de API.
 *
 * Portado del bot de soporte de PetroBox (Jarvis, repo `tickets`): en vez de
 * llamar a la API con una API key, se ejecuta el CLI de Claude Code en modo
 * headless (`claude -p`) autenticado con el token de una CUENTA con
 * suscripción. El consumo va contra el plan de esa cuenta, no contra crédito.
 *
 * La cuenta es DEDICADA al vendedor: su token vive en CLAUDE_CODE_OAUTH_TOKEN
 * y se genera una sola vez con `claude setup-token` (no caduca en horas como
 * el de una sesión interactiva).
 *
 * Diferencias con la versión de Jarvis:
 *   - El prompt de ventas va en `--system-prompt`, que REEMPLAZA el system
 *     prompt de agente de código del CLI (Jarvis lo aplana todo en el prompt).
 *   - `--exclude-dynamic-system-prompt-sections` recorta el contexto que el
 *     CLI agrega solo: baja de ~11.900 a ~2.900 tokens por llamada.
 *   - Las herramientas van deshabilitadas: el vendedor conversa, no toca disco.
 */

/** ¿Hay token de plan cargado? (si no, el vendedor cae a API key o a simulado). */
export function planEnabled(): boolean {
  return !!process.env.CLAUDE_CODE_OAUTH_TOKEN;
}

/**
 * Ruta del ejecutable de Claude Code. Configurable con CLAUDE_BIN porque cambia
 * según cómo se instaló (nativo, npm global, etc.); si no, se prueban las
 * ubicaciones habituales y al final se deja que lo resuelva el PATH.
 */
function claudeBin(): string {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  const home = os.homedir();
  const candidatos = [
    path.join(home, ".local/bin/claude"),
    path.join(home, ".npm-global/bin/claude"),
    "/usr/local/bin/claude",
  ];
  return candidatos.find((c) => existsSync(c)) ?? "claude";
}

/**
 * Carpeta de trabajo del CLI. Es un directorio vacío y descartable: el vendedor
 * no debe correr dentro del código del proyecto.
 */
function claudeCwd(): string {
  const dir = process.env.CLAUDE_CWD || path.join(os.tmpdir(), "easypos-vendedor");
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    /* si no se puede crear, el execFile falla abajo con un error claro */
  }
  return dir;
}

/**
 * El CLI usa alias de modelo (haiku · sonnet · opus), no los IDs largos de la
 * API. El panel puede tener cargado cualquiera de las dos formas.
 */
export function planModelAlias(model: string): string {
  const m = (model || "").toLowerCase();
  if (!m) return "sonnet";
  if (m === "haiku" || m === "sonnet" || m === "opus") return m;
  if (m.includes("haiku")) return "haiku";
  if (m.includes("opus")) return "opus";
  if (m.includes("sonnet")) return "sonnet";
  return "sonnet";
}

/** Herramientas que el vendedor NO necesita: solo tiene que conversar. */
const TOOLS_OFF = [
  "Bash",
  "Read",
  "Write",
  "Edit",
  "Glob",
  "Grep",
  "WebFetch",
  "WebSearch",
  "Task",
  "TodoWrite",
  "NotebookEdit",
];

/** Forma del JSON que devuelve `claude -p --output-format json`. */
interface PlanResult {
  is_error?: boolean;
  subtype?: string;
  result?: string;
  total_cost_usd?: number;
  model?: string | string[];
  usage?: Record<string, number>;
  modelUsage?: Record<string, Record<string, number>>;
}

const MAX_INTENTOS = 3;
/** El CLI arranca un proceso Node completo; los primeros segundos son de boot. */
const TIMEOUT_MS = Number(process.env.CLAUDE_TIMEOUT_MS ?? 90_000);

/**
 * Corre una consulta contra el plan y devuelve el texto de la respuesta.
 *
 * Reintenta las fallas intermitentes (hasta 3 veces con espera creciente) para
 * que un tropiezo de red no deje al cliente sin respuesta en WhatsApp.
 *
 * @param system prompt de sistema (la persona y las reglas del vendedor)
 * @param prompt la conversación ya formateada
 * @param model  alias o ID del modelo
 * @param tipo   etiqueta para el registro de uso (ej. "responder")
 */
export async function runClaudePlan(
  system: string,
  prompt: string,
  model: string,
  tipo = "responder",
  intento = 1
): Promise<string> {
  const args = [
    "-p",
    prompt,
    "--system-prompt",
    system,
    "--output-format",
    "json",
    "--no-session-persistence",
    "--exclude-dynamic-system-prompt-sections",
    "--model",
    planModelAlias(model),
    "--disallowedTools",
    ...TOOLS_OFF,
  ];

  // OJO: hay que SACAR las credenciales de API del entorno del hijo. Si quedan,
  // Claude Code las prefiere y la llamada se cobra al crédito de API en vez de
  // consumir del plan — que es exactamente lo que queremos evitar.
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  env.PATH = `${path.dirname(claudeBin())}:${process.env.PATH ?? ""}`;

  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      execFile(
        claudeBin(),
        args,
        { cwd: claudeCwd(), env, timeout: TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 },
        (error, out) => {
          // Con salida utilizable seguimos aunque el proceso haya devuelto != 0.
          if (error && !out) reject(new Error(`claude -p: ${error.message.slice(0, 200)}`));
          else resolve(out);
        }
      );
    });

    const data = JSON.parse(stdout) as PlanResult;
    if (data.is_error || data.subtype !== "success" || typeof data.result !== "string") {
      throw new Error(
        `claude: ${String(data.result ?? data.subtype ?? "sin result").slice(0, 140)}`
      );
    }

    // Se espera a propósito: si quedara suelto, en serverless (o al apagar el
    // proceso) el registro se perdería. Son milisegundos contra una llamada
    // de varios segundos, y nunca lanza.
    await logAiUsage(data, tipo);
    return data.result;
  } catch (error) {
    if (intento < MAX_INTENTOS) {
      const espera = 1000 * intento;
      console.warn(
        `[vendedor:plan] falló (intento ${intento}/${MAX_INTENTOS}), reintento en ${espera}ms:`,
        error instanceof Error ? error.message.slice(0, 120) : String(error)
      );
      await new Promise((r) => setTimeout(r, espera));
      return runClaudePlan(system, prompt, model, tipo, intento + 1);
    }
    throw error;
  }
}

/**
 * Registra tokens y costo de cada llamada en `ia_uso`. En modo plan el costo es
 * el que HABRÍA salido por API: sirve para ver cuánto está rindiendo el plan.
 * Best-effort: si falla, no rompe la respuesta al cliente.
 */
async function logAiUsage(data: PlanResult, tipo: string): Promise<void> {
  try {
    const clave = data.modelUsage ? Object.keys(data.modelUsage)[0] : undefined;
    const u = (clave ? data.modelUsage![clave] : data.usage) ?? {};
    const modelo =
      clave ?? (Array.isArray(data.model) ? data.model[0] : data.model) ?? "";
    const n = (...claves: string[]) => {
      for (const k of claves) if (typeof u[k] === "number") return u[k];
      return 0;
    };
    await query(
      `INSERT INTO ia_uso (modelo, tipo, input_tokens, output_tokens, cache_read, cache_creation, costo_usd)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        String(modelo),
        tipo,
        n("input_tokens", "inputTokens"),
        n("output_tokens", "outputTokens"),
        n("cache_read_input_tokens", "cacheReadInputTokens"),
        n("cache_creation_input_tokens", "cacheCreationInputTokens"),
        data.total_cost_usd ?? 0,
      ]
    );
  } catch {
    /* silencioso a propósito: el registro de uso nunca debe cortar una venta */
  }
}
