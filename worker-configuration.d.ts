/// <reference types="@cloudflare/workers-types" />

export interface Env {
  IMAGES: R2Bucket;
  /** 可选。自定义域名或 workers.dev 地址; 未设置时使用请求的 origin。 */
  PUBLIC_URL?: string;
  /** 管理员账号。 */
  ADMIN_USERNAME?: string;
  /** 管理员密码。建议通过 wrangler secret 或控制台 Secret 设置。 */
  ADMIN_PASSWORD?: string;
  /** 普通用户账号, 只能上传并管理自己的图片。 */
  USER_USERNAME?: string;
  /** 普通用户密码。建议通过 wrangler secret 或控制台 Secret 设置。 */
  USER_PASSWORD?: string;
  /** 可选。用于签名登录会话; 修改后所有已登录会话失效。 */
  SESSION_SECRET?: string;
}
