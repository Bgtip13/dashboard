export interface MonthlyRow {
  jabatan: string; area: string; nama: string;
  target: number; aktual: number;
  potensi: number; taTotal: number; noo: number; reaktif: number;
  trip: number; tripKuota: number;
}
export interface WeeklyRow { jabatan: string; area: string; nama: string; targetPerMinggu: number; act: number[]; }
export interface MonthlyPayload { updatedAt: string; rows: MonthlyRow[]; }
export interface WeeklyPayload { updatedAt: string; rows: WeeklyRow[]; }
export interface DapRow {
  area: string; kabupaten: string; kecamatan: string; toko: string; pelanggan: number;
  adm: string; kelasToko: string; kelasByr: string; bulanan: number[];
  omsetYtd: number; targetToko: number; status: string; bulanPasif: string;
}
export interface DapPayload { updatedAt: string; rows: DapRow[]; }
