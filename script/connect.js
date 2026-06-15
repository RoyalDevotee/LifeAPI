function connect(interval = 1000, timeout = 30000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const connection = setInterval(() => {
            fetch("https://lifeapi.zone.id")
                .then(res => {
                    if (!res.ok) {
                        throw new Error(`HTTP ${res.status}`);
                    }
                    return res.text();
                })
                .then(resp => {
                    if (resp.includes("CONNECTED")) {
                        clearInterval(connection);
                        resolve(resp);
                    }

                    if (Date.now() - startTime >= timeout) {
                        clearInterval(connection);
                        reject(new Error("Connection timeout"));
                    }
                })
                .catch(err => {
                    clearInterval(connection);
                    reject(err);
                });
        }, interval);
    });
}
