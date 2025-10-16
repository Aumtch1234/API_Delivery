console.log("System timezone:", Intl.DateTimeFormat().resolvedOptions().timeZone);
console.log("Local time:", new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }));
