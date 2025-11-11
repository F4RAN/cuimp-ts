export interface CuimpDescriptor {
  browser?: string
  version?: string
  architecture?: string
  platform?: string
}

export interface BinaryInfo {
    binaryPath: string
    isDownloaded: boolean
    version?: string
}

export type Method =
  | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface CuimpRequestConfig {
  url?: string;
  method?: Method;
  baseURL?: string;
  headers?: Record<string, string | number | boolean>;
  params?: Record<string, string | number | boolean | undefined>;
  data?: string | Buffer | Record<string, unknown> | URLSearchParams;
  timeout?: number;
  maxRedirects?: number;
  proxy?: string;
  insecureTLS?: boolean;
  signal?: AbortSignal;
  extraCurlArgs?: string[]; // Additional curl arguments like --cookie, --cookie-jar, etc.
}

export interface CuimpResponse<T = any> {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: T;
  rawBody: Buffer;
  request: {
    url: string;
    method: Method;
    headers: Record<string, string | number | boolean>;
    command: string; // full command preview
  };
}


export interface CuimpOptions {
  descriptor?: CuimpDescriptor
  path?: string
  extraCurlArgs?: string[] // Global curl arguments applied to all requests
}




export interface CuimpInstance {
  request<T = any>(config: CuimpRequestConfig): Promise<CuimpResponse<T>>;
  get<T = any>(url: string, config?: Omit<CuimpRequestConfig,'url'|'method'|'data'>): Promise<CuimpResponse<T>>;
  delete<T = any>(url: string, config?: Omit<CuimpRequestConfig,'url'|'method'|'data'>): Promise<CuimpResponse<T>>;
  head<T = any>(url: string, config?: Omit<CuimpRequestConfig,'url'|'method'|'data'>): Promise<CuimpResponse<T>>;
  options<T = any>(url: string, config?: Omit<CuimpRequestConfig,'url'|'method'|'data'>): Promise<CuimpResponse<T>>;
  post<T = any>(url: string, data?: CuimpRequestConfig['data'], config?: Omit<CuimpRequestConfig,'url'|'method'|'data'>): Promise<CuimpResponse<T>>;
  put<T = any>(url: string, data?: CuimpRequestConfig['data'], config?: Omit<CuimpRequestConfig,'url'|'method'|'data'>): Promise<CuimpResponse<T>>;
  patch<T = any>(url: string, data?: CuimpRequestConfig['data'], config?: Omit<CuimpRequestConfig,'url'|'method'|'data'>): Promise<CuimpResponse<T>>;
}

