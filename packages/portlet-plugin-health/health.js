const os = require("os")

function getIpList() {
    const list = []
    const ilist = []
    const interfaces = os.networkInterfaces()
    for (let iface in interfaces) {
        for (let i in interfaces[iface]) {
            const f = interfaces[iface][i]
            if (f.family === "IPv4") {
                if (f.internal) {
                    ilist.push(f.address)
                    break
                } else {
                    list.push(f.address)
                    break
                }
            }
        }
    }
    return list.length > 0 ? list : ilist
}

const getCpuInfo = () => {
	const cpus = os.cpus();
	const load = os.loadavg();
	const cpu = {
		load1: load[0],
		load5: load[1],
		load15: load[2],
		cores: Array.isArray(cpus) ? os.cpus().length : null,
	};
	cpu.utilization = Math.min(Math.floor(load[0] * 100 / cpu.cores), 100);

	return cpu;
};

function getCpuUsage(sampleTime = 100) {
	return new Promise((resolve, reject) => {
		try {
			const first = os.cpus().map(cpu => cpu.times);
			setTimeout(() => {
				try {
					const second = os.cpus().map(cpu => cpu.times);
					setTimeout(() => {
						try {
							const third = os.cpus().map(cpu => cpu.times);

							const usages = [];
							for (let i = 0; i < first.length; i++) {
								const first_idle = first[i].idle;
								const first_total = first[i].idle + first[i].user + first[i].nice + first[i].sys + first[i].irq;
								const second_idle = second[i].idle;
								const second_total = second[i].idle + second[i].user + second[i].nice + second[i].sys + second[i].irq;
								const third_idle = third[i].idle;
								const third_total = third[i].idle + third[i].user + third[i].nice + third[i].sys + third[i].irq;
								const first_usage = 1 - (second_idle - first_idle) / (second_total - first_total);
								const second_usage = 1 - (third_idle - second_idle) / (third_total - second_total);
								const per_usage = (first_usage + second_usage) / 2 * 100;
								usages.push(per_usage);
							}

							resolve({
								avg: usages.reduce((a, b) => a + b, 0) / usages.length,
								usages
							});
						} catch (err) {
							reject(err);
						}
					}, sampleTime);
				} catch (err) {
					reject(err);
				}
			}, sampleTime);
		} catch (err) {
			reject(err);
		}
	});
};

const getMemoryInfo = () => {
	const mem = {
		free: os.freemem(),
		total: os.totalmem()
	};
	mem.percent = (mem.free * 100 / mem.total);

	return mem;
};

const getUserInfo = () => {
	try {
		return os.userInfo();
	} catch (e) {
		return {};
	}
};

const getOsInfo = () => {
	return {
		uptime: os.uptime(),
		type: os.type(),
		release: os.release(),
		hostname: os.hostname(),
		arch: os.arch(),
		platform: os.platform(),
		user: getUserInfo()
	};
};

const getProcessInfo = () => {
	return {
		pid: process.pid,
		memory: process.memoryUsage(),
		uptime: process.uptime(),
		argv: process.argv,
		version: process.version
	};
};

const getNetworkInterfacesInfo = () => {
	return {
		ip: getIpList()
	};
};

const getDateTimeInfo = () => {
	return {
		now: Date.now(),
		iso: new Date().toISOString(),
		utc: new Date().toUTCString()
	};
};

const getHealthStatus = (/*broker*/) => {
	return {
		cpu: getCpuInfo(),
		mem: getMemoryInfo(),
		os: getOsInfo(),
		process: getProcessInfo(),
		net: getNetworkInterfacesInfo(),
		time: getDateTimeInfo()
	};
};

module.exports = {
	getHealthStatus,
	getCpuInfo,
	getMemoryInfo,
	getOsInfo,
	getProcessInfo,
	getNetworkInterfacesInfo,
	getDateTimeInfo,
	getCpuUsage
};
