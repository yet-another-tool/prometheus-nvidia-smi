const http = require("http")
const client = require('prom-client');
const { spawn } = require('node:child_process');

const PROMETHEUS_PORT = 9999;

async function getReadings() {
    return new Promise((resolve) => {
        const response = []
        const ls = spawn('nvidia-smi', [
            "--query-gpu=timestamp,name,pci.bus_id,driver_version,pstate,pcie.link.gen.max,pcie.link.gen.current,temperature.gpu,utilization.gpu,utilization.memory,memory.total,memory.free,memory.used",
            "--format=csv"]);

        ls.stdout.setEncoding('utf8');

        ls.stdout.on('data', (data) => {
            response.push(data.split(","))
        });

        ls.stderr.on('data', (data) => {
            console.error(`[ERROR] ${data}`);
        });

        ls.on('close', (code) => {
            return resolve({ response, code })
        });
    })
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
        .replace(/_{2,}/g, '_')
        .replace(/_$/g, '')
        .toLowerCase();
}

function sanitizeValue(value) {
    if (value.includes("%")) {
        return value.split("%")[0].trim() / 100
    } else if (value.includes("MiB")) {
        return value.split("MiB")[0].trim() * 1048576
    } else if (/^\d+$/.test(value.trim())) {
        return parseInt(value)
    } else if (!isNaN(value.trim()) && value.trim().toString().indexOf('.') != -1) {
        return parseFloat(value)
    } else {
        console.info("[INFO] No sanitization done.")
        return value.trim();
    }
}


const register = new client.Registry()

// ---
async function collectMetrics() {
    console.debug("collectMetrics")
    const { response } = await getReadings();
    labels = response[0].map(r => sanitizeLabel(r.replace(/\r\n/g, "")))
    data = response[1].map(r => sanitizeValue(r.replace(/\r\n/g, "")))
}

// metrics
let data, labels;

const temperature_gpu = new client.Gauge({
    name: 'temperature_gpu',
    help: 'Temperature of the GPU in Celsius',
    collect() {
        // Invoked when the registry collects its metrics' values.
        const currentValue = data[labels.indexOf("temperature_gpu")]
        this.set(currentValue);
    },
});


const utilization_gpu = new client.Gauge({
    name: 'utilization_gpu',
    help: 'GPU Utilization in percent (%)',
    collect() {
        // Invoked when the registry collects its metrics' values.
        const currentValue = data[labels.indexOf("utilization_gpu")]
        this.set(currentValue);
    },
});

const utilization_memory = new client.Gauge({
    name: 'utilization_memory',
    help: 'GPU Memory Utilization in percent (%)',
    collect() {
        // Invoked when the registry collects its metrics' values.
        const currentValue = data[labels.indexOf("utilization_memory")]
        this.set(currentValue);
    },
});

const memory_total_mib = new client.Gauge({
    name: 'memory_total_mib',
    help: 'GPU Total Memory in bytes',
    collect() {
        // Invoked when the registry collects its metrics' values.
        const currentValue = data[labels.indexOf("memory_total_mib")]
        this.set(currentValue);
    },
});

const memory_used_mib = new client.Gauge({
    name: 'memory_used_mib',
    help: 'GPU Used Memory in bytes',
    collect() {
        // Invoked when the registry collects its metrics' values.
        const currentValue = data[labels.indexOf("memory_used_mib")]
        this.set(currentValue);
    },
});

const memory_free_mib = new client.Gauge({
    name: 'memory_free_mib',
    help: 'GPU Free Memory in bytes',
    collect() {
        // Invoked when the registry collects its metrics' values.
        const currentValue = data[labels.indexOf("memory_free_mib")]
        this.set(currentValue);
    },
});

register.registerMetric(temperature_gpu);
register.registerMetric(utilization_gpu);
register.registerMetric(utilization_memory);
register.registerMetric(memory_total_mib);
register.registerMetric(memory_used_mib);
register.registerMetric(memory_free_mib);

// Define the HTTP server
const server = http.createServer(async (req, res) => {
    try {
        const route = req.url

        if (route === '/metrics') {
            // Refresh Values
            await collectMetrics();

            res.setHeader('Content-Type', register.contentType)
            return res.end(await register.metrics())
        }

        res.setHeader('Content-Type', "application/json")
        res.statusCode = 400
        return res.end(JSON.stringify({ message: "Go to /metrics" }))
    } catch (e) {
        console.error(e)
        res.statusCode = 500
        return res.end(JSON.stringify({ message: e.message, stack: e.stackTrace }))
    }
})

server.listen(
    PROMETHEUS_PORT,
    () => {
        console.log(`Listening on port ${PROMETHEUS_PORT}`)
    })