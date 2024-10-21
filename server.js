const express = require('express');
let promClient;

try {
  promClient = require('prom-client');
  console.log('prom-client successfully imported');
} catch (error) {
  console.error('Failed to import prom-client:', error.message);
  promClient = null;
}

const app = express();
const port = 8000;

let register;
let totalRequestsCounter;

if (promClient) {
  register = new promClient.Registry();
  console.log('Prometheus Registry created');

  promClient.collectDefaultMetrics({ register });
  console.log('Default metrics collection enabled');

  const httpRequestDurationMicroseconds = new promClient.Histogram({
    name: 'http_request_duration_ms',
    help: 'Duration of HTTP requests in ms',
    labelNames: ['route'],
    buckets: [0.10, 5, 15, 50, 100, 200, 300, 400, 500]
  });

  const httpRequestsTotal = new promClient.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['route', 'status']
  });

  totalRequestsCounter = new promClient.Counter({
    name: 'total_requests',
    help: 'Total number of requests received'
  });

  register.registerMetric(httpRequestDurationMicroseconds);
  register.registerMetric(httpRequestsTotal);
  register.registerMetric(totalRequestsCounter);
  console.log('Custom metrics registered');

  app.use((req, res, next) => {
    const start = Date.now();
    totalRequestsCounter.inc();
    console.log(`Request received. Total requests: ${totalRequestsCounter.get()}`);
    res.on('finish', () => {
      const duration = Date.now() - start;
      httpRequestDurationMicroseconds.labels(req.path).observe(duration);
      httpRequestsTotal.labels(req.path, res.statusCode).inc();
    });
    next();
  });
}

function simulateError() {
  if (Math.random() < 0.2) {
    throw new Error('Random error occurred');
  }
}

app.get('/', (req, res) => {
  try {
    simulateError();
    res.json({ message: 'Welcome to the server. Use /fast or /slow routes.' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

app.get('/fast', (req, res) => {
  try {
    simulateError();
    res.json({ message: 'Hello! This is the fast route.' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

app.get('/slow', (req, res) => {
  try {
    simulateError();
    const startTime = Date.now();
    while (Date.now() - startTime < 5000) {
      Math.random() * Math.random();
    }
    res.json({ message: 'Heavy task completed. This was the slow route.' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

app.get('/metrics', async (req, res) => {
  console.log('Metrics endpoint accessed');
  if (!promClient || !register) {
    console.error('Prometheus client or registry not available');
    return res.status(500).json({ error: 'Metrics collection is not enabled' });
  }
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    console.log('Metrics generated:');
    console.log(metrics);
    res.end(metrics);
  } catch (err) {
    console.error('Error generating metrics:', err);
    res.status(500).json({ error: 'Failed to generate metrics', message: err.message });
  }
});

app.use((req, res) => {
  console.log(`404 error for route: ${req.url}`);
  res.status(404).json({ error: 'Not Found', message: 'The requested resource does not exist.' });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log('Available routes:');
  console.log(`  - http://localhost:${port}/`);
  console.log(`  - http://localhost:${port}/fast`);
  console.log(`  - http://localhost:${port}/slow`);
  console.log(`  - http://localhost:${port}/metrics`);
});