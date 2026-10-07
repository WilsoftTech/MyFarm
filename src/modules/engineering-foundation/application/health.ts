import type { AuthorizationService } from "./authorization";
export interface DatabaseProbe { ping(): Promise<void> }
export class HealthService {
constructor(private readonly authorization: AuthorizationService, private readonly probe: DatabaseProbe) {}
async readiness() { await this.authorization.account(); await this.probe.ping(); return { status: "ready" as const }; }
}
