import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { resolveApiUrl } from './api.config';

export interface IphoneCatalogItem {
  model: string;
  year: number | null;
  colors: string[];
  storages: string[];
}

export interface IphoneCatalogResponse {
  source: string;
  sourceUrl: string;
  syncedAt: string;
  devices: IphoneCatalogItem[];
}

export interface ImeiValidationResponse {
  imei: string;
  normalizedImei: string;
  isValid: boolean;
  reason: string;
  providerConfigured: boolean;
  validationMode: string;
  selectedModel: string | null;
  selectedModelInCatalog: boolean;
  note: string;
}

@Injectable({
  providedIn: 'root'
})
export class DeviceService {
  private readonly iphoneCatalogUrl = resolveApiUrl('/devices/apple/iphones');
  private readonly imeiValidationUrl = resolveApiUrl('/devices/imei/validate');

  constructor(private http: HttpClient) {}

  getIphoneCatalog(): Observable<IphoneCatalogResponse> {
    return this.http.get<IphoneCatalogResponse>(this.iphoneCatalogUrl);
  }

  validateImei(imei: string, model?: string): Observable<ImeiValidationResponse> {
    return this.http.post<ImeiValidationResponse>(this.imeiValidationUrl, {
      imei,
      model,
    });
  }
}
