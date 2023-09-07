const http = require("node:http");
const client = require("prom-client");
const { execSync } = require("node:child_process");

const Gauges = require("./gauges");

const PROMETHEUS_PORT = process.env.PROMETHEUS_PORT || 9999;

async function getReadings() {
  return new Promise((resolve) => {
    const ls = execSync(
      `nvidia-smi --query-gpu=timestamp,name,pci.bus_id,driver_version,pstate,pcie.link.gen.max,pcie.link.gen.current,temperature.gpu,utilization.gpu,utilization.memory,memory.total,memory.free,memory.used --format=csv`
    );

    return resolve({
      response: ls
        .toString()
        .split("\n") // labels / Values
        .map((l) => l.split(",")),
    });
  });
}

//
// Clean Nvidia SMI Output (Labels)
//
// Inputs:
// timestamp
// name
// pci.bus_id
// driver_version
// pstate
// pcie.link.gen.max
// pcie.link.gen.current
// temperature.gpu
// utilization.gpu [%]
// utilization.memory [%]
// memory.total [MiB]
// memory.free [MiB]
// memory.used [MiB]
//
// Outputs:
// [
//   'timestamp',
//   'name',
//   'pci_bus_id',
//   'driver_version',
//   'pstate',
//   'pcie_link_gen_max',
//   'pcie_link_gen_current',
//   'temperature_gpu',
//   'utilization_gpu',
//   'utilization_memory',
//   'memory_total_mib',
//   'memory_free_mib',
//   'memory_used_mib'
// ]
function sanitizeLabel(label) {
  return label
    .trim()
    .replace(/[. \[\]\%]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/_$/g, "")
    .toLowerCase();
}

function sanitizeValue(value) {
  if (value.includes("%")) {
    return value.split("%")[0].trim() / 100;
  } else if (value.includes("MiB")) {
    return value.split("MiB")[0].trim() * 1048576;
  } else if (/^\d+$/.test(value.trim())) {
    return parseInt(value);
  } else if (
    !isNaN(value.trim()) &&
    value.trim().toString().indexOf(".") != -1
  ) {
    return parseFloat(value);
  } else {
    console.info("[INFO] No sanitization done.");
    return value.trim();
  }
}

const register = new client.Registry();

// ---
async function collectMetrics() {
  console.debug("collectMetrics");
  const { response } = await getReadings();
  labels = response[0].map((r) => sanitizeLabel(r.replace(/\n/g, "")));
  data = response[1].map((r) => sanitizeValue(r.replace(/\n/g, "")));
}

// metrics
let data, labels;

const gauges = Gauges();
gauges.forEach((gauge) => {
  register.registerMetric(
    new client.Gauge({
      name: gauge.key,
      help: gauge.help,
      collect() {
        const currentValue = data[labels.indexOf(gauge.key)];
        this.set(currentValue);
      },
    })
  );
});

// Define the HTTP server
const server = http.createServer(async (req, res) => {
  try {
    const route = req.url;

    if (route === "/metrics") {
      // Refresh Values
      await collectMetrics();

      res.setHeader("Content-Type", register.contentType);
      return res.end(await register.metrics());
    }

    res.setHeader("Content-Type", "application/json");
    res.statusCode = 400;
    return res.end(JSON.stringify({ message: "Go to /metrics" }));
  } catch (e) {
    console.error(e);
    res.statusCode = 500;
    return res.end(JSON.stringify({ message: e.message, stack: e.stackTrace }));
  }
});

server.listen(PROMETHEUS_PORT, () => {
  console.log(`Listening on port ${PROMETHEUS_PORT}`);
});
