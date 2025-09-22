#!/usr/bin/env node

/**
 * Advanced Health Check Script
 * Performs comprehensive health checks on the application
 */

const http = require('http');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

// Configuration
const CONFIG = {
  host: process.env.HEALTH_HOST || 'localhost',
  port: process.env.HEALTH_PORT || 5056,
  path: process.env.HEALTH_PATH || '/',
  timeout: parseInt(process.env.HEALTH_TIMEOUT) || 10000,
  retries: parseInt(process.env.HEALTH_RETRIES) || 3,
  retryDelay: parseInt(process.env.HEALTH_RETRY_DELAY) || 2000,
  containerName: process.env.PACKAGE_NAME || 'jdadzok_server',
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

class HealthChecker {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      overall: false,
      checks: {},
      errors: [],
    };
  }

  log(message, color = 'reset') {
    const timestamp = new Date().toISOString();
    console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
  }

  async delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async checkHttpEndpoint(retries = CONFIG.retries) {
    this.log('🔍 Checking HTTP endpoint...', 'blue');

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await this.makeHttpRequest();
        this.results.checks.http = {
          status: 'healthy',
          responseTime: result.responseTime,
          statusCode: result.statusCode,
          attempt: attempt,
        };
        this.log(
          `✅ HTTP endpoint healthy (${result.responseTime}ms, status: ${result.statusCode})`,
          'green',
        );
        return true;
      } catch (error) {
        this.log(
          `❌ HTTP check failed (attempt ${attempt}/${retries}): ${error.message}`,
          'red',
        );

        if (attempt === retries) {
          this.results.checks.http = {
            status: 'unhealthy',
            error: error.message,
            attempts: retries,
          };
          this.results.errors.push(
            `HTTP endpoint check failed: ${error.message}`,
          );
          return false;
        }

        await this.delay(CONFIG.retryDelay);
      }
    }
  }

  makeHttpRequest() {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const url = `http://${CONFIG.host}:${CONFIG.port}${CONFIG.path}`;

      const request = http.get(url, { timeout: CONFIG.timeout }, (response) => {
        const responseTime = Date.now() - startTime;
        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          if (response.statusCode >= 200 && response.statusCode < 400) {
            resolve({
              statusCode: response.statusCode,
              responseTime: responseTime,
              data: data,
            });
          } else {
            reject(new Error(`HTTP ${response.statusCode}: ${data}`));
          }
        });
      });

      request.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      request.on('timeout', () => {
        request.destroy();
        reject(new Error(`Request timeout after ${CONFIG.timeout}ms`));
      });
    });
  }

  async checkContainerStatus() {
    this.log('🐳 Checking container status...', 'blue');

    try {
      const { stdout } = await execAsync(
        `docker ps --filter "name=${CONFIG.containerName}_api" --format "{{.Names}}\t{{.Status}}\t{{.Image}}"`,
      );

      if (stdout.trim()) {
        const lines = stdout.trim().split('\n');
        const containerInfo = lines[0].split('\t');

        this.results.checks.container = {
          status: 'running',
          name: containerInfo[0],
          containerStatus: containerInfo[1],
          image: containerInfo[2],
        };

        this.log(
          `✅ Container running: ${containerInfo[0]} (${containerInfo[1]})`,
          'green',
        );
        return true;
      } else {
        this.results.checks.container = {
          status: 'not_running',
          error: 'No containers found',
        };
        this.results.errors.push('Container is not running');
        this.log('❌ Container is not running', 'red');
        return false;
      }
    } catch (error) {
      this.results.checks.container = {
        status: 'error',
        error: error.message,
      };
      this.results.errors.push(`Container check failed: ${error.message}`);
      this.log(`❌ Container check failed: ${error.message}`, 'red');
      return false;
    }
  }

  async checkDockerHealth() {
    this.log('🏥 Checking Docker health status...', 'blue');

    try {
      const { stdout } = await execAsync(
        `docker inspect --format='{{.State.Health.Status}}' ${CONFIG.containerName}_api 2>/dev/null || echo "none"`,
      );
      const healthStatus = stdout.trim();

      if (healthStatus === 'healthy') {
        this.results.checks.dockerHealth = {
          status: 'healthy',
        };
        this.log('✅ Docker health check: healthy', 'green');
        return true;
      } else if (healthStatus === 'unhealthy') {
        this.results.checks.dockerHealth = {
          status: 'unhealthy',
        };
        this.results.errors.push('Docker health check reports unhealthy');
        this.log('❌ Docker health check: unhealthy', 'red');
        return false;
      } else {
        this.results.checks.dockerHealth = {
          status: 'no_healthcheck',
          note: 'No health check configured',
        };
        this.log('⚠️  No Docker health check configured', 'yellow');
        return true; // Don't fail if no health check is configured
      }
    } catch (error) {
      this.results.checks.dockerHealth = {
        status: 'error',
        error: error.message,
      };
      this.log(`⚠️  Docker health check error: ${error.message}`, 'yellow');
      return true; // Don't fail the overall check for this
    }
  }

  async checkDependencies() {
    this.log('🔗 Checking service dependencies...', 'blue');

    const dependencies = [
      { name: 'postgres', container: 'jdadzok_db', port: 5431 },
      { name: 'redis', container: 'jdadzok_redis', port: 6378 },
    ];

    let allDepsHealthy = true;
    this.results.checks.dependencies = {};

    for (const dep of dependencies) {
      try {
        const { stdout } = await execAsync(
          `docker ps --filter "name=${dep.container}" --format "{{.Status}}"`,
        );

        if (stdout.trim() && stdout.includes('Up')) {
          this.results.checks.dependencies[dep.name] = {
            status: 'running',
            container: dep.container,
          };
          this.log(`✅ ${dep.name} dependency: running`, 'green');
        } else {
          this.results.checks.dependencies[dep.name] = {
            status: 'not_running',
            container: dep.container,
          };
          this.results.errors.push(`${dep.name} dependency is not running`);
          this.log(`❌ ${dep.name} dependency: not running`, 'red');
          allDepsHealthy = false;
        }
      } catch (error) {
        this.results.checks.dependencies[dep.name] = {
          status: 'error',
          error: error.message,
          container: dep.container,
        };
        this.log(
          `❌ ${dep.name} dependency check failed: ${error.message}`,
          'red',
        );
        allDepsHealthy = false;
      }
    }

    return allDepsHealthy;
  }

  async performAllChecks() {
    this.log('🚀 Starting comprehensive health check...', 'cyan');

    const checks = [
      this.checkContainerStatus(),
      this.checkDockerHealth(),
      this.checkDependencies(),
      this.checkHttpEndpoint(),
    ];

    const results = await Promise.all(checks);
    this.results.overall = results.every((result) => result);

    this.log('📊 Health check summary:', 'cyan');
    this.log(
      `   Container Status: ${this.results.checks.container?.status || 'unknown'}`,
      this.results.checks.container?.status === 'running' ? 'green' : 'red',
    );
    this.log(
      `   Docker Health: ${this.results.checks.dockerHealth?.status || 'unknown'}`,
      this.results.checks.dockerHealth?.status === 'healthy'
        ? 'green'
        : 'yellow',
    );
    this.log(
      `   HTTP Endpoint: ${this.results.checks.http?.status || 'unknown'}`,
      this.results.checks.http?.status === 'healthy' ? 'green' : 'red',
    );

    // Log dependency status
    if (this.results.checks.dependencies) {
      for (const [name, dep] of Object.entries(
        this.results.checks.dependencies,
      )) {
        this.log(
          `   ${name}: ${dep.status}`,
          dep.status === 'running' ? 'green' : 'red',
        );
      }
    }

    if (this.results.overall) {
      this.log('🎉 Overall health status: HEALTHY', 'green');
    } else {
      this.log('💥 Overall health status: UNHEALTHY', 'red');
      if (this.results.errors.length > 0) {
        this.log('Errors found:', 'red');
        this.results.errors.forEach((error) => {
          this.log(`  - ${error}`, 'red');
        });
      }
    }

    return this.results;
  }

  getExitCode() {
    return this.results.overall ? 0 : 1;
  }
}

// Main execution
async function main() {
  const checker = new HealthChecker();

  try {
    const results = await checker.performAllChecks();

    // Output JSON if requested
    if (process.argv.includes('--json')) {
      console.log(JSON.stringify(results, null, 2));
    }

    process.exit(checker.getExitCode());
  } catch (error) {
    console.error(
      `${colors.red}Health check failed with error: ${error.message}${colors.reset}`,
    );
    process.exit(1);
  }
}

// Handle CLI arguments
if (process.argv.includes('--help')) {
  console.log(`
Health Check Script

Usage: node health-check.js [options]

Options:
  --json     Output results in JSON format
  --help     Show this help message

Environment Variables:
  HEALTH_HOST         Host to check (default: localhost)
  HEALTH_PORT         Port to check (default: 5056)
  HEALTH_PATH         Health endpoint path (default: /health)
  HEALTH_TIMEOUT      Request timeout in ms (default: 10000)
  HEALTH_RETRIES      Number of retries (default: 3)
  HEALTH_RETRY_DELAY  Delay between retries in ms (default: 2000)
  PACKAGE_NAME        Container name prefix (default: jdadzok_server)
    `);
  process.exit(0);
}

// Run the health check
if (require.main === module) {
  main();
}

module.exports = HealthChecker;
