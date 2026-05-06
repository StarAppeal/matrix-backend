export interface IUserPollingService {
    startPollingForUser(uuid: string): void | Promise<void>;
    stopPollingForUser(uuid: string): void;
}
