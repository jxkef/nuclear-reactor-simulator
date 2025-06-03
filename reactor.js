class Turbine {
    constructor() {
        this.rpm = 0;
        this.maxRpm = 3600;
        this.efficiency = 1;
        this.health = 100;
        this.steamInput = 0;
        this.output = 0;
        this.maxOutput = 1000;
        this.angle = 0;
    }

    update(deltaTime) {
        // Update RPM based on steam input
        const targetRpm = (this.steamInput / 100) * this.maxRpm;
        const rpmDiff = targetRpm - this.rpm;
        this.rpm += rpmDiff * Math.min(1, (deltaTime / 1000) * 0.3);

        // Update angle for animation
        this.angle += (this.rpm / 60) * (deltaTime / 1000) * Math.PI * 2;

        // Calculate output based on RPM and efficiency
        this.output = (this.rpm / this.maxRpm) * this.maxOutput * this.efficiency * (this.health / 100);

        // Gradual health degradation
        this.health -= (this.rpm / this.maxRpm) * 0.001 * (deltaTime / 1000);
        this.health = Math.max(0, this.health);

        // Efficiency drops with lower health
        this.efficiency = 0.5 + (this.health / 100) * 0.5;
    }

    maintain() {
        this.health = 100;
        this.efficiency = 1;
    }
}

class ReactorCore {
    constructor() {
        this.temperature = 20; // Celsius
        this.maxTemp = 1000;
        this.powerOutput = 0; // MW
        this.maxPower = 1000;
        this.targetControlRodPosition = 100; // 0-100%, 100% = fully inserted
        this.controlRodPosition = 100;
        this.targetCoolantFlow = 100; // 0-100%
        this.coolantFlow = 100;
        this.fissionRate = 0;
        this.damaged = false;
        this.scramActive = false;
        this.events = [];
        this.steamParticles = [];

        // Coolant Infusion System
        // Overdrive system
        this.overdriveActive = false;
        this.overdriveDuration = 45000; // 45 seconds
        this.overdriveTimeRemaining = 0;
        this.overdriveCooldown = 5000; // 5 seconds
        this.overdriveCooldownRemaining = 0;
        this.overdriveActivationCost = 30000;
        this.originalMaxTemp = 1000;
        this.maxTemp = this.originalMaxTemp;
        this.overdriveTempBonus = 400; // Boost to 1400°C
        this.overdriveWearMultiplier = 3;

        // New properties
        this.revenue = 0;
        this.operatingCosts = 0;
        this.profit = 0;
        this.totalProfit = 0;
        this.fuelRods = Array(5).fill({ health: 100 });
        this.coolantQuality = 100;
        this.coolantEfficiency = 1;
        this.controlRodNoiseAmount = 0;
        this.powerDemand = 0.5;
        
        // Constants
        this.POWER_PRICE = 500; // $/MWh
        this.BASE_OPERATING_COST = 100000; // $/hr
        this.FUEL_COST = 1000000;
        this.COOLANT_COST = 100000;
        this.TURBINE_MAINTENANCE_COST = 250000;
        
        // Grid zones with different demand patterns
        this.gridZones = [
            { name: 'Industrial', demand: 0.8, priceMultiplier: 1.2, stabilityRequired: 0.95 },
            { name: 'Residential', demand: 0.5, priceMultiplier: 1.0, stabilityRequired: 0.9 },
            { name: 'Commercial', demand: 0.6, priceMultiplier: 1.1, stabilityRequired: 0.85 }
        ];
        
        // Advanced systems
        this.coolantChemistry = {
            pH: 7.0,
            conductivity: 100,
            dissolvedOxygen: 5,
            maxQuality: 100
        };
        
        // Component wear factors
        this.wearFactors = {
            turbineBearing: 100,
            pumpSeals: 100,
            valveIntegrity: 100,
            sensorAccuracy: 100
        };
    }

    update(deltaTime) {
        if (this.damaged) return;

        // Update overdrive status
        if (this.overdriveActive) {
            this.overdriveTimeRemaining -= deltaTime;
            if (this.overdriveTimeRemaining <= 0) {
                this.overdriveActive = false;
                this.maxTemp = this.originalMaxTemp;
                this.overdriveTimeRemaining = 0;
                this.overdriveCooldownRemaining = this.overdriveCooldown;
                audioManager.playSound('overdrive_deactivate');
            }
        } else if (this.overdriveCooldownRemaining > 0) {
            this.overdriveCooldownRemaining -= deltaTime;
            if (this.overdriveCooldownRemaining < 0) {
                this.overdriveCooldownRemaining = 0;
            }
        }

        // Add control rod noise for sensor glitch event
        const noise = this.controlRodNoiseAmount ? (Math.random() - 0.5) * this.controlRodNoiseAmount : 0;

        // Update control rod position with lag and noise
        const rodDiff = (this.targetControlRodPosition - this.controlRodPosition) + noise;
        this.controlRodPosition += rodDiff * Math.min(1, (deltaTime / 1000) * 0.5);

        // Update coolant flow with lag
        const coolantDiff = this.targetCoolantFlow - this.coolantFlow;
        this.coolantFlow += coolantDiff * Math.min(1, (deltaTime / 1000) * 0.5);

        // Calculate average fuel rod health
        const avgFuelHealth = this.fuelRods.reduce((sum, rod) => sum + rod.health, 0) / this.fuelRods.length;

        // Calculate fission rate based on control rod position and fuel health
        this.fissionRate = Math.max(0, (100 - this.controlRodPosition) / 100) * (avgFuelHealth / 100);

        // Temperature changes with randomness and coolant efficiency
        const powerFactor = this.fissionRate * (1 + Math.random() * 0.2);
        let coolingFactor = (this.coolantFlow / 100) * (this.coolantQuality / 100) * (1 + Math.random() * 0.1);
        
        // More dynamic temperature changes
        const tempChange = (powerFactor * 70 - coolingFactor * 40) * (deltaTime / 1000);
        this.temperature = Math.max(20, this.temperature + tempChange);

        // Calculate power output based on fission rate and temperature
        this.powerOutput = this.fissionRate * this.maxPower * (this.temperature / 500);

        // Update steam particles
        this.updateSteamParticles(deltaTime);

        // Degrade fuel rods based on usage
        this.fuelRods = this.fuelRods.map(rod => ({
            health: Math.max(0, rod.health - this.fissionRate * 0.01 * (deltaTime / 1000))
        }));

        // Degrade coolant quality
        const coolantDegradation = (this.temperature / this.maxTemp) * 0.05 * (deltaTime / 1000);
        this.coolantQuality = Math.max(0, this.coolantQuality - coolantDegradation);

        // Check for damage conditions
        if (this.temperature > this.maxTemp) {
            this.damaged = true;
            this.totalProfit = Math.max(0, this.totalProfit - 5000000); // Major penalty for meltdown
        }

        // Handle SCRAM
        if (this.scramActive) {
            this.targetControlRodPosition = 100;
            this.totalProfit = Math.max(0, this.totalProfit - 1000000); // Penalty for emergency shutdown
        }

        // Update events
        this.updateEvents(deltaTime);

        // Update financials
        this.updateFinancials(deltaTime);
    }

    updateFinancials(deltaTime) {
        // Calculate hourly values based on deltaTime (5x faster)
        const hourFraction = (deltaTime / (1000 * 60 * 60)) * 5;

        // Calculate base revenue from turbine output
        let baseRevenue = this.turbine.output * this.POWER_PRICE * hourFraction;

        // Apply grid zone multipliers
        this.revenue = this.gridZones.reduce((total, zone) => {
            const zoneDemandMet = Math.min(1, this.turbine.output / (this.maxPower * zone.demand));
            const zoneRevenue = (baseRevenue / this.gridZones.length) * zone.priceMultiplier;
            
            // Apply stability bonus/penalty
            const stabilityFactor = zoneDemandMet >= zone.stabilityRequired ? 1.2 : 0.8;
            return total + (zoneRevenue * stabilityFactor);
        }, 0);

        // Calculate operating costs
        this.operatingCosts = this.BASE_OPERATING_COST * hourFraction;

        // Additional costs based on operation and wear
        const wearCost = Object.values(this.wearFactors).reduce((total, factor) => 
            total + (1 - factor/100) * this.BASE_OPERATING_COST * 0.1, 0);
        
        this.operatingCosts += (this.powerOutput / this.maxPower) * this.BASE_OPERATING_COST * 0.5 * hourFraction;
        this.operatingCosts += wearCost * hourFraction;

        // Chemistry management costs
        const chemCost = (Math.abs(this.coolantChemistry.pH - 7) * 1000 +
                         Math.abs(this.coolantChemistry.conductivity - 100) * 10 +
                         Math.abs(this.coolantChemistry.dissolvedOxygen - 5) * 100) * hourFraction;
        this.operatingCosts += chemCost;

        // Calculate profit
        this.profit = this.revenue - this.operatingCosts;
        this.totalProfit += this.profit;

        // Update wear factors with overdrive multiplier
        Object.keys(this.wearFactors).forEach(component => {
            let wear = Math.random() * 0.1 * (this.powerOutput / this.maxPower) * hourFraction;
            if (this.overdriveActive) {
                wear *= this.overdriveWearMultiplier;
            }
            this.wearFactors[component] = Math.max(0, this.wearFactors[component] - wear);
        });

        // Update coolant chemistry
        this.coolantChemistry.pH += (Math.random() - 0.5) * 0.1 * hourFraction;
        this.coolantChemistry.conductivity += (Math.random() - 0.5) * 5 * hourFraction;
        this.coolantChemistry.dissolvedOxygen += (Math.random() - 0.5) * 0.5 * hourFraction;
    }

    updateEvents(deltaTime) {
        // Remove expired events
        this.events = this.events.filter(event => event.timeRemaining > 0);

        // Update existing events
        this.events.forEach(event => {
            event.timeRemaining -= deltaTime;
            if (event.timeRemaining <= 0) {
                event.onExpire(this);
            }
        });

        // Randomly add new events more frequently
        if (Math.random() < 0.002 * (deltaTime / 1000) && this.events.length < 2) {
            this.addRandomEvent();
        }

        // Gradually change power demand
        this.powerDemand += (Math.random() - 0.5) * 0.01 * (deltaTime / 1000);
        this.powerDemand = Math.max(0.3, Math.min(0.9, this.powerDemand));
    }

    addRandomEvent() {
        const events = [
            {
                name: "Chemistry Imbalance",
                description: "Coolant chemistry parameters out of spec! Adjust system or face efficiency loss.",
                duration: 20000,
                onStart: (reactor) => {
                    reactor.coolantChemistry.pH += (Math.random() - 0.5) * 2;
                    reactor.coolantChemistry.conductivity += (Math.random() - 0.5) * 50;
                    reactor.coolantChemistry.dissolvedOxygen += (Math.random() - 0.5) * 5;
                },
                onExpire: (reactor) => {
                    if (Math.abs(reactor.coolantChemistry.pH - 7) > 1 ||
                        Math.abs(reactor.coolantChemistry.conductivity - 100) > 20 ||
                        Math.abs(reactor.coolantChemistry.dissolvedOxygen - 5) > 2) {
                        reactor.coolantEfficiency *= 0.8;
                        reactor.totalProfit = Math.max(0, reactor.totalProfit - 200000);
                    }
                }
            },
            {
                name: "Grid Zone Emergency",
                description: "Critical power needed in Industrial Zone! Maintain 90% output for 30 seconds!",
                duration: 30000,
                onStart: (reactor) => {
                    reactor.gridZones[0].demand = 0.9;
                    reactor.gridZones[0].priceMultiplier = 2.0;
                },
                onExpire: (reactor) => {
                    if (reactor.turbine.output < reactor.maxPower * 0.9) {
                        reactor.totalProfit = Math.max(0, reactor.totalProfit - 1000000);
                    } else {
                        reactor.totalProfit += 500000; // Bonus for meeting emergency demand
                    }
                    reactor.gridZones[0].demand = 0.8;
                    reactor.gridZones[0].priceMultiplier = 1.2;
                }
            },
            {
                name: "Component Wear Alert",
                description: "Multiple components showing excessive wear! Address immediately!",
                duration: 25000,
                onStart: (reactor) => {
                    Object.keys(reactor.wearFactors).forEach(component => {
                        reactor.wearFactors[component] *= 0.7;
                    });
                },
                onExpire: (reactor) => {
                    const avgWear = Object.values(reactor.wearFactors).reduce((a,b) => a + b, 0) / 
                                  Object.values(reactor.wearFactors).length;
                    if (avgWear < 50) {
                        reactor.turbine.efficiency *= 0.8;
                        reactor.totalProfit = Math.max(0, reactor.totalProfit - 300000);
                    }
                }
            },
            {
                name: "Coolant Pump Malfunction",
                description: "Coolant pump efficiency dropping! Increase coolant flow to compensate!",
                duration: 15000,
                onStart: (reactor) => {
                    reactor.coolantEfficiency = 0.5;
                },
                onExpire: (reactor) => {
                    reactor.coolantEfficiency = 1;
                }
            },
            {
                name: "Power Demand Surge",
                description: "Grid demanding more power! Increase output to 80% within 20 seconds!",
                duration: 20000,
                targetPower: 0.8,
                onExpire: (reactor) => {
                    if (reactor.turbine.output < reactor.maxPower * 0.7) {
                        reactor.totalProfit = Math.max(0, reactor.totalProfit - 500000);
                    }
                }
            },
            {
                name: "Control Rod Sensor Glitch",
                description: "Control rod position sensors malfunctioning! Manual adjustment needed!",
                duration: 12000,
                onStart: (reactor) => {
                    reactor.controlRodNoiseAmount = 20;
                },
                onExpire: (reactor) => {
                    reactor.controlRodNoiseAmount = 0;
                }
            },
            {
                name: "Turbine Vibration",
                description: "High turbine vibration detected! Reduce RPM or risk damage!",
                duration: 15000,
                onStart: (reactor) => {
                    reactor.turbine.efficiency *= 0.7;
                },
                onExpire: (reactor) => {
                    if (reactor.turbine.rpm > reactor.turbine.maxRpm * 0.8) {
                        reactor.turbine.health = Math.max(0, reactor.turbine.health - 30);
                    }
                    reactor.turbine.efficiency = 0.5 + (reactor.turbine.health / 100) * 0.5;
                }
            },
            {
                name: "Grid Frequency Deviation",
                description: "Grid frequency unstable! Maintain exact 50% power output!",
                duration: 25000,
                onExpire: (reactor) => {
                    const deviation = Math.abs(reactor.turbine.output / reactor.maxPower - 0.5);
                    if (deviation > 0.1) {
                        reactor.totalProfit = Math.max(0, reactor.totalProfit - 300000);
                    }
                }
            }
        ];

        const event = events[Math.floor(Math.random() * events.length)];
        event.timeRemaining = event.duration;
        if (event.onStart) event.onStart(this);
        this.events.push(event);
    }

    updateSteamParticles(deltaTime) {
        // Add new steam particles based on temperature and power output
        if (this.temperature > 100 && Math.random() < (this.powerOutput / this.maxPower) * 0.5) {
            this.steamParticles.push({
                x: Math.random() * 600,
                y: 400,
                velocity: Math.random() * 2 + 1,
                opacity: 1
            });
        }

        // Update existing particles
        this.steamParticles = this.steamParticles.filter(particle => {
            particle.y -= particle.velocity * (deltaTime / 16);
            particle.opacity -= 0.01 * (deltaTime / 16);
            return particle.opacity > 0;
        });
    }

    replaceFuelRods() {
        if (this.totalProfit >= this.FUEL_COST) {
            this.fuelRods = Array(5).fill({ health: 100 });
            this.totalProfit -= this.FUEL_COST;
            return true;
        }
        return false;
    }

    replaceCoolant() {
        if (this.totalProfit >= this.COOLANT_COST) {
            this.coolantQuality = 100;
            this.totalProfit -= this.COOLANT_COST;
            return true;
        }
        return false;
    }

    maintainTurbine() {
        if (this.totalProfit >= this.TURBINE_MAINTENANCE_COST) {
            this.turbine.maintain();
            this.totalProfit -= this.TURBINE_MAINTENANCE_COST;
            return true;
        }
        return false;
    }

    adjustControlRods(position) {
        if (this.damaged || this.scramActive) return;
        this.targetControlRodPosition = Math.max(0, Math.min(100, position));
    }

    adjustCoolantFlow(flow) {
        if (this.damaged) return;
        this.targetCoolantFlow = Math.max(0, Math.min(100, flow));
    }

    scram() {
        this.scramActive = true;
    }

    activateOverdrive() {
        if (this.overdriveActive || this.overdriveCooldownRemaining > 0 || 
            this.totalProfit < this.overdriveActivationCost || this.damaged) return;

        this.totalProfit -= this.overdriveActivationCost;
        this.overdriveActive = true;
        this.overdriveTimeRemaining = this.overdriveDuration;
        this.maxTemp = this.originalMaxTemp + this.overdriveTempBonus;
    }
}

class ReactorRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.colors = {
            background: '#1a1a1a',
            vessel: '#444',
            coolant: '#00aaff',
            fuelRod: '#ffaa00',
            controlRod: '#666',
            warning: '#ff0000'
        };
    }

    render(reactor) {
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw reactor vessel
        this.ctx.fillStyle = this.colors.vessel;
        this.ctx.fillRect(50, 50, this.canvas.width - 100, this.canvas.height - 100);

        // Draw coolant with wave effect
        const coolantHeight = (reactor.coolantFlow / 100) * (this.canvas.height - 120);
        this.ctx.fillStyle = `rgba(0, 170, 255, ${reactor.coolantQuality / 100})`;
        this.ctx.beginPath();
        this.ctx.moveTo(60, this.canvas.height - 60);
        
        // Create wave effect
        for (let x = 60; x <= this.canvas.width - 60; x += 20) {
            const wave = Math.sin(x / 30 + Date.now() / 500) * 5;
            this.ctx.lineTo(x, this.canvas.height - 60 - coolantHeight + wave);
        }
        
        this.ctx.lineTo(this.canvas.width - 60, this.canvas.height - 60);
        this.ctx.closePath();
        this.ctx.fill();

        // Draw fuel rods and control rods with glow effect
        const rodWidth = 30;
        const numRods = 5;
        const spacing = (this.canvas.width - 120) / (numRods + 1);

        for (let i = 0; i < numRods; i++) {
            const x = 60 + spacing * (i + 1) - rodWidth / 2;
            const rodHealth = reactor.fuelRods[i].health;

            // Draw fuel rod glow
            const glow = reactor.fissionRate * 30 * (rodHealth / 100);
            this.ctx.fillStyle = `rgba(255, 170, 0, ${0.3 * (rodHealth / 100)})`;
            this.ctx.beginPath();
            this.ctx.arc(x + rodWidth/2, this.canvas.height/2, glow, 0, Math.PI * 2);
            this.ctx.fill();

            // Draw fuel rod with health-based color
            const r = 255;
            const g = Math.floor(170 * (rodHealth / 100));
            const b = 0;
            this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            this.ctx.fillRect(x, 100, rodWidth, this.canvas.height - 200);

            // Draw control rod with smooth movement
            const rodPosition = (reactor.controlRodPosition / 100) * (this.canvas.height - 200);
            this.ctx.fillStyle = this.colors.controlRod;
            this.ctx.fillRect(x, 100, rodWidth, rodPosition);
        }

        // Draw steam particles
        reactor.steamParticles.forEach(particle => {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity * 0.3})`;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, 5, 0, Math.PI * 2);
            this.ctx.fill();
        });

        // Draw temperature effect
        const tempAlpha = Math.min(1, Math.max(0, (reactor.temperature - 400) / 600));
        if (tempAlpha > 0) {
            this.ctx.fillStyle = `rgba(255, 0, 0, ${tempAlpha * 0.3})`;
            this.ctx.fillRect(50, 50, this.canvas.width - 100, this.canvas.height - 100);
        }

        // Draw damage effect
        if (reactor.damaged) {
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Draw power demand
        this.ctx.fillStyle = 'white';
        this.ctx.font = '20px Arial';
        this.ctx.fillText(`Power Demand: ${Math.round(reactor.powerDemand * 100)}%`, 60, 30);
    }
}

class TurbineRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }

    render(turbine) {
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw turbine housing
        this.ctx.fillStyle = '#444';
        this.ctx.fillRect(20, 150, 160, 100);

        // Draw turbine blades
        this.ctx.save();
        this.ctx.translate(100, 200);
        this.ctx.rotate(turbine.angle);

        const numBlades = 8;
        const bladeLength = 40;
        const health = turbine.health / 100;

        for (let i = 0; i < numBlades; i++) {
            this.ctx.fillStyle = `rgba(170, 170, 170, ${health})`;
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            this.ctx.lineTo(bladeLength * Math.cos(i * Math.PI * 2 / numBlades), 
                           bladeLength * Math.sin(i * Math.PI * 2 / numBlades));
            this.ctx.lineTo(bladeLength * 0.3 * Math.cos((i + 1) * Math.PI * 2 / numBlades),
                           bladeLength * 0.3 * Math.sin((i + 1) * Math.PI * 2 / numBlades));
            this.ctx.closePath();
            this.ctx.fill();
        }

        this.ctx.restore();

        // Draw RPM and health
        this.ctx.fillStyle = 'white';
        this.ctx.font = '14px Arial';
        this.ctx.fillText(`RPM: ${Math.round(turbine.rpm)}`, 20, 280);
        this.ctx.fillText(`Health: ${Math.round(turbine.health)}%`, 20, 300);
        this.ctx.fillText(`Output: ${Math.round(turbine.output)} MW`, 20, 320);
    }
}

// Initialize audio manager
const audioManager = new AudioManager();

// Main simulation code
const canvas = document.getElementById('reactorCanvas');
const turbineCanvas = document.getElementById('turbineCanvas');
const reactor = new ReactorCore();
const turbine = new Turbine();
reactor.turbine = turbine;
const renderer = new ReactorRenderer(canvas);
const turbineRenderer = new TurbineRenderer(turbineCanvas);

// Connect volume slider
document.getElementById('volumeSlider').addEventListener('input', (e) => {
    audioManager.setMasterVolume(e.target.value / 100);
});

// UI elements
const tempGauge = document.getElementById('tempGauge');
const powerGauge = document.getElementById('powerGauge');
const turbineGauge = document.getElementById('turbineGauge');
const controlRodSlider = document.getElementById('controlRodSlider');
const coolantSlider = document.getElementById('coolantSlider');
const tempValue = document.getElementById('tempValue');
const powerValue = document.getElementById('powerValue');
const turbineValue = document.getElementById('turbineValue');
const statusDiv = document.getElementById('status');
const statusMessage = document.getElementById('statusMessage');
const alarmDiv = document.getElementById('alarm');
const eventNotification = document.getElementById('eventNotification');
const fuelHealthGauge = document.getElementById('fuelHealthGauge');
const fuelHealthValue = document.getElementById('fuelHealthValue');
const coolantQualityGauge = document.getElementById('coolantQualityGauge');
const coolantQualityValue = document.getElementById('coolantQualityValue');
const revenueValue = document.getElementById('revenueValue');
const costsValue = document.getElementById('costsValue');
const profitValue = document.getElementById('profitValue');
const totalBalanceValue = document.getElementById('totalBalanceValue');

// Event listeners
controlRodSlider.addEventListener('input', (e) => {
    reactor.adjustControlRods(100 - e.target.value);
    audioManager.playSound('button_click');
});
coolantSlider.addEventListener('input', (e) => {
    reactor.adjustCoolantFlow(e.target.value);
    audioManager.playSound('button_click');
});
document.getElementById('scram').addEventListener('click', () => {
    reactor.scram();
    audioManager.playSound('high_temp_alarm');
});
document.getElementById('replaceFuel').addEventListener('click', () => {
    if (reactor.replaceFuelRods()) {
        audioManager.playSound('button_click');
    }
});
document.getElementById('replaceCoolant').addEventListener('click', () => {
    if (reactor.replaceCoolant()) {
        audioManager.playSound('button_click');
    }
});
document.getElementById('maintainTurbine').addEventListener('click', () => {
    if (reactor.maintainTurbine()) {
        audioManager.playSound('button_click');
    }
});
document.getElementById('activateOverdrive').addEventListener('click', () => {
    if (reactor.totalProfit >= reactor.overdriveActivationCost) {
        reactor.activateOverdrive();
        audioManager.playSound('overdrive_activate');
    }
});

let lastTime = performance.now();
let lastFinancialUpdate = performance.now();

function formatMoney(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function updateUI() {
    // Update gauges with smooth transitions
    tempGauge.style.width = `${(reactor.temperature / reactor.maxTemp) * 100}%`;
    powerGauge.style.width = `${(reactor.powerOutput / reactor.maxPower) * 100}%`;
    turbineGauge.style.width = `${(turbine.output / turbine.maxOutput) * 100}%`;

    // Update values
    tempValue.textContent = `${Math.round(reactor.temperature)}°C`;
    powerValue.textContent = `${Math.round(reactor.powerOutput)} MW`;
    turbineValue.textContent = `${Math.round(turbine.output)} MW`;

    try {
        // Update grid zones
        for (let i = 0; i < reactor.gridZones.length; i++) {
            const zone = reactor.gridZones[i];
            const zonePrefix = zone.name.toLowerCase();
            const demandEl = document.getElementById(`${zonePrefix}Demand`);
            const priceEl = document.getElementById(`${zonePrefix}Price`);
            const stabilityEl = document.getElementById(`${zonePrefix}Stability`);
            
            if (demandEl && priceEl && stabilityEl) {
                demandEl.textContent = `${Math.round(zone.demand * 100)}%`;
                priceEl.textContent = `${zone.priceMultiplier.toFixed(1)}x`;
                const stability = Math.min(1, reactor.turbine.output / (reactor.maxPower * zone.demand));
                stabilityEl.style.width = `${stability * 100}%`;
                stabilityEl.style.backgroundColor = stability >= zone.stabilityRequired ? '#00ff00' : '#ff0000';
            }
        }
    } catch (e) {
        console.log('Grid zone elements not ready');
    }

    try {
        // Update component wear factors
        for (const [component, health] of Object.entries(reactor.wearFactors)) {
            const elementId = component.replace(/([A-Z])/g, '').toLowerCase();
            const healthEl = document.getElementById(`${elementId}Health`);
            const gaugeEl = document.getElementById(`${elementId}Gauge`);
            
            if (healthEl && gaugeEl) {
                healthEl.textContent = `${Math.round(health)}%`;
                gaugeEl.style.width = `${health}%`;
                gaugeEl.style.backgroundColor = health > 70 ? '#00ff00' : health > 30 ? '#ffaa00' : '#ff0000';
            }
        }
    } catch (e) {
        console.log('Component wear elements not ready');
    }

    try {
        // Update coolant chemistry
        const pHEl = document.getElementById('pHValue');
        const condEl = document.getElementById('conductivityValue');
        const o2El = document.getElementById('oxygenValue');
        
        if (pHEl && condEl && o2El) {
            pHEl.textContent = reactor.coolantChemistry.pH.toFixed(1);
            condEl.textContent = `${Math.round(reactor.coolantChemistry.conductivity)} µS/cm`;
            o2El.textContent = `${reactor.coolantChemistry.dissolvedOxygen.toFixed(1)} ppb`;

            const pHDeviation = Math.abs(reactor.coolantChemistry.pH - 7) / 2;
            const condDeviation = Math.abs(reactor.coolantChemistry.conductivity - 100) / 50;
            const o2Deviation = Math.abs(reactor.coolantChemistry.dissolvedOxygen - 5) / 3;

            const pHGauge = document.getElementById('pHGauge');
            const condGauge = document.getElementById('conductivityGauge');
            const o2Gauge = document.getElementById('oxygenGauge');

            if (pHGauge && condGauge && o2Gauge) {
                pHGauge.style.width = `${Math.max(0, 100 - pHDeviation * 100)}%`;
                condGauge.style.width = `${Math.max(0, 100 - condDeviation * 100)}%`;
                o2Gauge.style.width = `${Math.max(0, 100 - o2Deviation * 100)}%`;

                [pHGauge, condGauge, o2Gauge].forEach(gauge => {
                    const value = parseFloat(gauge.style.width);
                    gauge.style.backgroundColor = value > 70 ? '#00ff00' : value > 30 ? '#ffaa00' : '#ff0000';
                });
            }
        }
    } catch (e) {
        console.log('Chemistry elements not ready');
    }

    // Update sliders to match actual positions (accounting for lag)
    controlRodSlider.value = 100 - reactor.controlRodPosition;
    coolantSlider.value = reactor.coolantFlow;

    // Update fuel and coolant gauges
    const avgFuelHealth = reactor.fuelRods.reduce((sum, rod) => sum + rod.health, 0) / reactor.fuelRods.length;
    fuelHealthGauge.style.width = `${avgFuelHealth}%`;
    fuelHealthValue.textContent = `${Math.round(avgFuelHealth)}%`;
    
    coolantQualityGauge.style.width = `${reactor.coolantQuality}%`;
    coolantQualityValue.textContent = `${Math.round(reactor.coolantQuality)}%`;

    // Update financial information every 500ms
    const currentTime = performance.now();
    if (currentTime - lastFinancialUpdate >= 500) {
        revenueValue.textContent = `${formatMoney(reactor.revenue * 3600)}/hr`;
        costsValue.textContent = `${formatMoney(reactor.operatingCosts * 3600)}/hr`;
        profitValue.textContent = `${formatMoney(reactor.profit * 3600)}/hr`;
        totalBalanceValue.textContent = formatMoney(reactor.totalProfit);
        lastFinancialUpdate = currentTime;
    }

    // Update maintenance button states
    document.getElementById('replaceFuel').disabled = reactor.totalProfit < reactor.FUEL_COST;
    document.getElementById('replaceCoolant').disabled = reactor.totalProfit < reactor.COOLANT_COST;
    document.getElementById('maintainTurbine').disabled = reactor.totalProfit < reactor.TURBINE_MAINTENANCE_COST;

    // Update overdrive UI
    const overdriveButton = document.getElementById('activateOverdrive');
    const overdriveState = document.getElementById('overdriveState');
    const overdriveCooldown = document.getElementById('overdriveCooldown');
    const currentMaxTemp = document.getElementById('currentMaxTemp');

    if (overdriveButton) {
        overdriveButton.disabled = reactor.overdriveActive || 
                                 reactor.overdriveCooldownRemaining > 0 || 
                                 reactor.totalProfit < reactor.overdriveActivationCost;
    }
    if (overdriveState) {
        if (reactor.overdriveActive) {
            overdriveState.textContent = `Active (${Math.ceil(reactor.overdriveTimeRemaining / 1000)}s)`;
            overdriveState.style.color = '#ff4400';
        } else {
            overdriveState.textContent = 'Inactive';
            overdriveState.style.color = '';
        }
    }
    if (overdriveCooldown) {
        if (reactor.overdriveCooldownRemaining > 0) {
            overdriveCooldown.textContent = `${Math.ceil(reactor.overdriveCooldownRemaining / 1000)}s`;
            overdriveCooldown.style.color = '#ffaa00';
        } else {
            overdriveCooldown.textContent = 'Ready';
            overdriveCooldown.style.color = '#00ff00';
        }
    }
    if (currentMaxTemp) {
        currentMaxTemp.textContent = Math.round(reactor.maxTemp);
    }

    // Update status and play sounds
    let statusClass = 'safe';
    let message = 'All systems functioning normally.';

    if (reactor.damaged) {
        statusClass = 'danger';
        message = 'REACTOR DAMAGED - CORE MELTDOWN';
        audioManager.playSound('high_temp_alarm');
    } else if (reactor.temperature > reactor.maxTemp * 0.8) {
        statusClass = 'danger';
        message = 'CRITICAL TEMPERATURE WARNING';
        if (!alarmDiv.style.display || alarmDiv.style.display === 'none') {
            audioManager.playSound('high_temp_alarm');
        }
    } else if (reactor.temperature > reactor.maxTemp * 0.6) {
        statusClass = 'warning';
        message = 'High temperature warning';
    }

    statusDiv.className = `status ${statusClass}`;
    statusMessage.textContent = message;
    alarmDiv.style.display = statusClass === 'danger' ? 'block' : 'none';

    // Update gauge colors based on values
    tempGauge.style.backgroundColor = reactor.temperature > reactor.maxTemp * 0.8 ? '#ff0000' : 
                                    reactor.temperature > reactor.maxTemp * 0.6 ? '#ffaa00' : '#00ff00';
    powerGauge.style.backgroundColor = reactor.powerOutput > reactor.maxPower * 0.8 ? '#ff0000' : '#00aaff';
    turbineGauge.style.backgroundColor = turbine.health < 30 ? '#ff0000' : 
                                       turbine.health < 60 ? '#ffaa00' : '#aa00ff';

    // Display active events and play notification sound
    if (reactor.events.length > 0) {
        const event = reactor.events[0];
        if (eventNotification.style.display === 'none') {
            audioManager.playSound('button_click');
        }
        eventNotification.textContent = `${event.name}: ${event.description} (${Math.ceil(event.timeRemaining / 1000)}s)`;
        eventNotification.style.display = 'block';
    } else {
        eventNotification.style.display = 'none';
    }

    // Update ambient sounds
    audioManager.updateAmbientSounds(reactor);
}

function gameLoop() {
    const currentTime = performance.now();
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    // Update steam flow to turbine based on reactor power
    turbine.steamInput = reactor.powerOutput / reactor.maxPower * 100;

    reactor.update(deltaTime);
    turbine.update(deltaTime);
    renderer.render(reactor);
    turbineRenderer.render(turbine);
    updateUI();

    requestAnimationFrame(gameLoop);
}

gameLoop();
