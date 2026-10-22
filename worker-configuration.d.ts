/// <reference types="@cloudflare/workers-types" />

export interface Env {
  IMAGES: R2Bucket;
  /** 可选。自定义域名或 workers.dev 地址; 未设置时使用请求的 origin。 */
  PUBLIC_URL?: string;
  /** 上传接口密钥。通过 `wrangler secret put UPLOAD_TOKEN` 设置。 */
  UPLOAD_TOKEN?: string;
  /** 列表 / 删除接口密钥。通过 `wrangler secret put ADMIN_TOKEN` 设置。 */
  ADMIN_TOKEN?: string;
}
