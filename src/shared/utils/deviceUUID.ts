export function getDeviceUUID(): string {
  let uuid = localStorage.getItem("deviceUUID");

  if (!uuid) {
    uuid = crypto.randomUUID();
    localStorage.setItem("deviceUUID", uuid);
  }

  return uuid;
}
