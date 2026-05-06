import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import logger from "./logger";

const userAgent = process.env.APP_USER_AGENT || "LEDMatrixApp/1.0";

export class HttpClient {
    private readonly axiosClient: AxiosInstance;

    constructor(axiosConfig: AxiosRequestConfig) {
        this.axiosClient = axios.create({
            ...axiosConfig,
            headers: {
                "User-Agent": userAgent,
                ...axiosConfig.headers,
            },
        });

        this.setupInterceptors();
    }

    public async get<T, D = never>(url: string, config?: AxiosRequestConfig<D>): Promise<T> {
        const response: AxiosResponse<T> = await this.axiosClient.get(url, config);
        return response.data;
    }

    public async post<T, D = never>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<T> {
        const response: AxiosResponse<T> = await this.axiosClient.post(url, data, config);
        return response.data;
    }

    public async put<T, D = never>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<T> {
        const response: AxiosResponse<T> = await this.axiosClient.put(url, data, config);
        return response.data;
    }

    public async patch<T, D = never>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<T> {
        const response: AxiosResponse<T> = await this.axiosClient.patch(url, data, config);
        return response.data;
    }

    public async delete<T, D = never>(url: string, config?: AxiosRequestConfig<D>): Promise<T> {
        const response: AxiosResponse<T> = await this.axiosClient.delete(url, config);
        return response.data;
    }

    private setupInterceptors() {
        this.axiosClient.interceptors.response.use(
            (response: AxiosResponse) => {
                return response;
            },
            (error: unknown) => {
                this.handleAxiosError(error);

                return Promise.reject(error);
            }
        );
    }

    private handleAxiosError(error: unknown) {
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError;
            const url = axiosError.config?.url || "Unknown URL";
            const method = axiosError.config?.method?.toUpperCase() || "Unknown method";

            if (axiosError.response) {
                logger.error(`[API Error] ${method} ${url}`);
                logger.error(`Status: ${axiosError.response.status}`);
                logger.error(`Data:`, axiosError.response.data);
            } else if (axiosError.request) {
                logger.error(`[Network Error] ${method} ${url} - No response from server.`);
            } else {
                logger.error(`[Request Setup Error] ${axiosError.message}`);
            }
        } else {
            logger.error(`[Unknown Error]`, error);
        }
    }
}
