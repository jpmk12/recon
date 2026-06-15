import type { Category } from "./db";

type Input = {
  vendor?: string | null;
  os?: string | null;
  ports: { port: number; service: string | null }[];
};

const VENDOR_RULES: { match: RegExp; cat: Category; needPort?: number }[] = [
  { match: /ubiquiti|mikrotik|cisco|netgear|asus(?:tek)?|tp-link|d-link|linksys|eero|orbi|google nest wifi/i, cat: "router" },
  { match: /synology|qnap|drobo|terramaster|buffalo|asustor/i, cat: "nas" },
  { match: /hp|hewlett|brother|canon|epson|lexmark|xerox|kyocera|ricoh/i, cat: "printer", needPort: 9100 },
  { match: /hikvision|dahua|axis|wyze|reolink|amcrest|arlo|ring|nest cam|unifi protect/i, cat: "camera" },
  { match: /amazon|sonos|google home|harman|bose/i, cat: "voice" },
  { match: /roku|chromecast|fire tv|firetv|samsung tv|lg electronics|vizio|sony bravia|apple tv|shield/i, cat: "tv" },
  { match: /nintendo|sony interactive|microsoft xbox/i, cat: "gaming" },
];

function hostHasPort(input: Input, port: number): boolean {
  return input.ports.some((p) => p.port === port);
}

function hostHasService(input: Input, needle: string): boolean {
  return input.ports.some((p) => (p.service ?? "").toLowerCase().includes(needle));
}

export function classifyHost(input: Input): Category {
  const vendor = (input.vendor ?? "").toLowerCase();
  const os = (input.os ?? "").toLowerCase();

  for (const rule of VENDOR_RULES) {
    if (rule.match.test(vendor)) {
      if (rule.needPort === undefined || hostHasPort(input, rule.needPort)) {
        return rule.cat;
      }
    }
  }

  if (hostHasPort(input, 9100) || hostHasPort(input, 631)) return "printer";
  if (hostHasService(input, "rtsp")) return "camera";

  if (/iphone|ipad|ios/.test(os)) return "phone";
  if (/android/.test(os)) return "phone";

  if (/macos|mac os x|darwin/.test(os)) return "laptop";
  if (/windows/.test(os)) return "laptop";

  const hasSsh = hostHasPort(input, 22);
  const webPorts = [80, 443, 3000, 8080, 8443, 9090];
  const hasWeb = webPorts.some((p) => hostHasPort(input, p));
  if (/linux|ubuntu|debian|fedora|arch|centos|rhel/.test(os)) {
    if (hasSsh && hasWeb) return "server";
    if (hasSsh) return "server";
    return "laptop";
  }

  if (hasSsh && hasWeb) return "server";
  if (input.ports.length > 0 && input.ports.length <= 3 && vendor) return "iot";

  return "unknown";
}

export const CATEGORY_LABELS: Record<Category, string> = {
  router: "Router",
  nas: "NAS",
  printer: "Printer",
  camera: "Camera",
  voice: "Smart speaker",
  iot: "IoT",
  phone: "Phone",
  server: "Server",
  laptop: "Computer",
  tv: "TV / streaming",
  gaming: "Gaming",
  unknown: "Unknown",
};
