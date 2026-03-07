/**
 * Sandboxed JavaScript execution via iframe
 * Provides a secure environment for running user code in the browser
 */

export interface ExecutionResult {
  output: Array<{ type: "log" | "warn" | "error" | "result"; content: string }>;
  error?: string;
  executionTime: number;
}

let sandboxIframe: HTMLIFrameElement | null = null;
let sandboxReady = false;
let sandboxReadyPromise: Promise<void> | null = null;
let messageId = 0;
const pendingExecutions = new Map<
  number,
  { resolve: (result: ExecutionResult) => void; reject: (error: Error) => void }
>();

/**
 * Creates and returns a sandboxed iframe for code execution
 */
function createSandbox(): { iframe: HTMLIFrameElement; ready: Promise<void> } {
  if (sandboxIframe && document.body.contains(sandboxIframe) && sandboxReadyPromise) {
    return { iframe: sandboxIframe, ready: sandboxReadyPromise };
  }

  // Reset state
  sandboxReady = false;
  
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.sandbox.add("allow-scripts");
  
  // Create promise that resolves when sandbox signals ready
  sandboxReadyPromise = new Promise<void>((resolveReady) => {
    const readyHandler = (event: MessageEvent) => {
      if (event.data?.type === "sandbox-ready") {
        sandboxReady = true;
        window.removeEventListener("message", readyHandler);
        resolveReady();
      }
    };
    window.addEventListener("message", readyHandler);
    
    // Fallback timeout in case ready message is missed
    setTimeout(() => {
      if (!sandboxReady) {
        window.removeEventListener("message", readyHandler);
        resolveReady();
      }
    }, 1000);
  });
  
  // Create the sandbox HTML with console overrides
  const sandboxHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <script>
        const output = [];
        
        // Override console methods
        console.log = (...args) => {
          output.push({ type: 'log', content: args.map(a => formatValue(a)).join(' ') });
        };
        console.warn = (...args) => {
          output.push({ type: 'warn', content: args.map(a => formatValue(a)).join(' ') });
        };
        console.error = (...args) => {
          output.push({ type: 'error', content: args.map(a => formatValue(a)).join(' ') });
        };
        console.info = console.log;
        console.debug = console.log;
        
        function formatValue(val) {
          if (val === null) return 'null';
          if (val === undefined) return 'undefined';
          if (typeof val === 'object') {
            try {
              return JSON.stringify(val, null, 2);
            } catch {
              return String(val);
            }
          }
          return String(val);
        }
        
        // Listen for execution requests
        window.addEventListener('message', async (event) => {
          const { id, code } = event.data;
          if (typeof id !== 'number' || typeof code !== 'string') return;
          
          output.length = 0;
          const startTime = performance.now();
          let error = null;
          let result = undefined;
          
          try {
            // Wrap in async function to support await
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            const fn = new AsyncFunction(code);
            result = await fn();
            
            // Add return value to output if not undefined
            if (result !== undefined) {
              output.push({ type: 'result', content: '=> ' + formatValue(result) });
            }
          } catch (e) {
            error = e.message || String(e);
            output.push({ type: 'error', content: error });
          }
          
          const executionTime = performance.now() - startTime;
          
          parent.postMessage({
            id,
            output: [...output],
            error,
            executionTime
          }, '*');
        });
        
        // Signal that sandbox is ready
        parent.postMessage({ type: 'sandbox-ready' }, '*');
      <\/script>
    </head>
    <body></body>
    </html>
  `;

  iframe.srcdoc = sandboxHtml;
  document.body.appendChild(iframe);
  sandboxIframe = iframe;

  return { iframe, ready: sandboxReadyPromise };
}

/**
 * Initialize the message listener for sandbox responses
 */
function initMessageListener() {
  if (typeof window === "undefined") return;
  
  window.addEventListener("message", (event) => {
    // Ignore sandbox-ready messages
    if (event.data?.type === "sandbox-ready") return;
    
    const { id, output, error, executionTime } = event.data || {};
    if (typeof id !== "number") return;

    const pending = pendingExecutions.get(id);
    if (pending) {
      pendingExecutions.delete(id);
      pending.resolve({ output: output || [], error, executionTime: executionTime || 0 });
    }
  });
}

// Initialize listener on module load (client-side only)
if (typeof window !== "undefined") {
  initMessageListener();
}

/**
 * Execute JavaScript code in the sandboxed iframe
 * @param code - The JavaScript code to execute
 * @param timeout - Maximum execution time in milliseconds (default: 5000)
 * @returns Promise<ExecutionResult> - The execution output and any errors
 */
export async function executeCode(
  code: string,
  timeout: number = 5000
): Promise<ExecutionResult> {
  if (typeof window === "undefined") {
    return {
      output: [{ type: "error", content: "Sandbox only available in browser" }],
      error: "Sandbox only available in browser",
      executionTime: 0,
    };
  }

  const { iframe, ready } = createSandbox();

  // Wait for sandbox to be ready
  await ready;

  return new Promise((resolve) => {
    const id = ++messageId;

    // Set up timeout
    const timeoutId = setTimeout(() => {
      pendingExecutions.delete(id);
      resolve({
        output: [{ type: "error", content: "Execution timed out (5s limit)" }],
        error: "Execution timed out",
        executionTime: timeout,
      });
    }, timeout);

    // Store the pending execution
    pendingExecutions.set(id, {
      resolve: (result) => {
        clearTimeout(timeoutId);
        resolve(result);
      },
      reject: () => {
        clearTimeout(timeoutId);
        resolve({
          output: [{ type: "error", content: "Execution failed" }],
          error: "Execution failed",
          executionTime: 0,
        });
      },
    });

    // Send code to sandbox
    iframe.contentWindow?.postMessage({ id, code }, "*");
  });
}

/**
 * Destroy the sandbox iframe and clean up resources
 */
export function destroySandbox(): void {
  if (sandboxIframe && document.body.contains(sandboxIframe)) {
    document.body.removeChild(sandboxIframe);
  }
  sandboxIframe = null;
  sandboxReady = false;
  sandboxReadyPromise = null;
  pendingExecutions.clear();
}
