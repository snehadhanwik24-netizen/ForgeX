const { spawn } = require("child_process");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "../..");

const PYTHON_SCRIPT = path.join(
    PROJECT_ROOT,
    "engine",
    "api",
    "engine_api.py"
);

const EXECUTION_TIMEOUT_MS = 15000;
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;

const runPythonEngine = (request) => {
    return new Promise((resolve, reject) => {
        let settled = false;
        let stdout = "";
        let stderr = "";
        let totalOutputBytes = 0;
        let timedOut = false;
        let outputExceeded = false;

        const finish = (error, result) => {
            if (settled) return;

            settled = true;
            clearTimeout(timeout);

            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        };

        let python;

        try {
            python = spawn(
                process.env.PYTHON_EXECUTABLE || "python",
                [PYTHON_SCRIPT],
                {
                    cwd: PROJECT_ROOT,
                    windowsHide: true,
                    stdio: ["pipe", "pipe", "pipe"]
                }
            );
        } catch (error) {
            return finish(
                new Error(`Unable to start Python: ${error.message}`)
            );
        }

        const terminateProcess = () => {
            if (!python.killed) {
                python.kill();
            }
        };

        const timeout = setTimeout(() => {
            timedOut = true;

            finish(
                new Error("Python engine execution timed out after 15 seconds")
            );

            terminateProcess();
        }, EXECUTION_TIMEOUT_MS);

        const collectOutput = (data, destination) => {
            if (settled) return;

            totalOutputBytes += data.length;

            if (totalOutputBytes > MAX_OUTPUT_BYTES) {
                outputExceeded = true;

                finish(
                    new Error("Python engine output exceeded the 5 MB limit")
                );

                terminateProcess();
                return;
            }

            if (destination === "stdout") {
                stdout += data.toString();
            } else {
                stderr += data.toString();
            }
        };

        python.stdout.on("data", (data) => {
            collectOutput(data, "stdout");
        });

        python.stderr.on("data", (data) => {
            collectOutput(data, "stderr");
        });

        python.on("error", (error) => {
            finish(
                new Error(`Unable to start Python: ${error.message}`)
            );
        });

        python.on("close", (code) => {
            if (settled) return;

            if (timedOut) {
                return finish(
                    new Error("Python engine execution timed out")
                );
            }

            if (outputExceeded) {
                return finish(
                    new Error("Python engine output exceeded the limit")
                );
            }

            let result;

            try {
                result = JSON.parse(stdout);
            } catch {
                return finish(
                    new Error(stderr || "Invalid response from Python engine")
                );
            }

            if (code !== 0 || !result.success) {
                return finish(
                    new Error(
                        result.message || stderr || "Python engine failed"
                    )
                );
            }

            finish(null, result.data);
        });

        python.stdin.on("error", (error) => {
            finish(
                new Error(`Python input error: ${error.message}`)
            );
        });

        try {
            python.stdin.end(JSON.stringify(request));
        } catch (error) {
            finish(
                new Error(`Unable to send request to Python: ${error.message}`)
            );

            terminateProcess();
        }
    });
};

module.exports = { runPythonEngine };
