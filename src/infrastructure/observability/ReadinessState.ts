import { Injectable } from '@nestjs/common';

@Injectable()
export class ReadinessState {
  private shuttingDown = false;

  public get isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  public markShuttingDown(): void {
    this.shuttingDown = true;
  }
}
