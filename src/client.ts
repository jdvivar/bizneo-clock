import type { Session } from "./config.js";

export class SessionExpiredError extends Error {
  constructor(message = "Your Bizneo session has expired. Run `bizneo-clock login` to sign in again.") {
    super(message);
    this.name = "SessionExpiredError";
  }
}

export class RequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "RequestError";
    this.status = status;
  }
}

/** Authenticated HTTP client that replays the captured browser session. */
export class BizneoClient {
  readonly session: Session;
  /** Set when the server rotated session cookies and they should be re-saved. */
  cookiesChanged = false;

  constructor(session: Session) {
    this.session = session;
  }

  private get base(): string {
    return `https://${this.session.host}`;
  }

  private cookieHeader(): string {
    return Object.entries(this.session.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  private baseHeaders(): Record<string, string> {
    return {
      "user-agent": this.session.userAgent,
      "accept-language": "en-GB,en;q=0.9,es;q=0.7",
      cookie: this.cookieHeader(),
      "cache-control": "no-cache",
      pragma: "no-cache",
    };
  }

  /** Merge any Set-Cookie values back into the session (sliding 30-day expiry). */
  private absorbCookies(res: Response): void {
    const setCookies = res.headers.getSetCookie?.() ?? [];
    for (const sc of setCookies) {
      const [pair] = sc.split(";");
      const eq = pair.indexOf("=");
      if (eq <= 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (!value) continue;
      if (this.session.cookies[name] !== value) {
        this.session.cookies[name] = value;
        this.cookiesChanged = true;
      }
    }
  }

  private looksLikeLogin(body: string): boolean {
    return /name="password"|id="session_email"|name="session\[email\]"/i.test(body);
  }

  /** GET an HTMX fragment / page and return its HTML body. */
  async getHtml(path: string): Promise<string> {
    const res = await fetch(this.base + path, {
      method: "GET",
      redirect: "manual",
      headers: {
        ...this.baseHeaders(),
        accept: "*/*",
        "hx-request": "true",
        "hx-target": "chronometer-wrapper",
        "hx-current-url": this.base + "/",
      },
    });
    this.absorbCookies(res);

    if (res.status === 401) throw new SessionExpiredError();
    if (res.status >= 300 && res.status < 400) throw new SessionExpiredError();

    const body = await res.text();
    if (!res.ok) throw new RequestError(res.status, `GET ${path} failed (${res.status})`);
    if (this.looksLikeLogin(body)) throw new SessionExpiredError();
    return body;
  }

  /** Submit a chrono form (urlencoded). `method` is the real HTTP verb. */
  async submitForm(method: "POST" | "PUT", path: string, fields: Record<string, string>, csrfToken: string): Promise<string> {
    const body = new URLSearchParams(fields).toString();
    const res = await fetch(this.base + path, {
      method,
      redirect: "manual",
      headers: {
        ...this.baseHeaders(),
        accept: "*/*",
        "content-type": "application/x-www-form-urlencoded",
        "x-csrf-token": csrfToken,
        "x-no-layout": "true",
        "hx-request": "true",
        "hx-target": "chronometer-wrapper",
        "hx-trigger": "chrono-form-default_chrono",
        "hx-current-url": this.base + "/",
        origin: this.base,
        referer: this.base + "/",
      },
      body,
    });
    this.absorbCookies(res);

    if (res.status === 401) throw new SessionExpiredError();
    if (res.status >= 300 && res.status < 400) throw new SessionExpiredError();

    const text = await res.text();
    if (res.status === 403) {
      throw new RequestError(403, "Request rejected (403). The session or CSRF token may be stale — try `bizneo-clock login` again.");
    }
    if (!res.ok) throw new RequestError(res.status, `${method} ${path} failed (${res.status})`);
    return text;
  }
}
