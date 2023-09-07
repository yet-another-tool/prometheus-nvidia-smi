# Prometheus nvidia-smi

Collect nvidia-smi data and returns the data as metrics to be consumed by prometheus Server.

## Prerequisites

- `nvidia-smi` command line

## Usage

```bash
npm install
npm run start
```

**Usage with PM2**

```bash
npm i -g pm2
pm2 start src/index.js
```

```
curl http://localhost:9999/metrics
```

### Advanced

**Available Environment Variables**
_Default Values:_

```bash
export PROMETHEUS_PORT=9999
```

---

# Output

```text
# HELP temperature_gpu Temperature of the GPU in Celsius
# TYPE temperature_gpu gauge
temperature_gpu 75

# HELP utilization_gpu GPU Utilization in percent (%)
# TYPE utilization_gpu gauge
utilization_gpu 0.91

# HELP utilization_memory GPU Memory Utilization in percent (%)
# TYPE utilization_memory gauge
utilization_memory 0.01

# HELP memory_total_mib GPU Total Memory in bytes
# TYPE memory_total_mib gauge
memory_total_mib 12878610432

# HELP memory_used_mib GPU Used Memory in bytes
# TYPE memory_used_mib gauge
memory_used_mib 344981504

# HELP memory_free_mib GPU Free Memory in bytes
# TYPE memory_free_mib gauge
memory_free_mib 12247367680
```
