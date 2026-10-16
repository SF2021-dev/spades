import { onRequestGet as __api_auth_confirm_js_onRequestGet } from "/workspace/spades/functions/api/auth/confirm.js"
import { onRequestPost as __api_auth_login_js_onRequestPost } from "/workspace/spades/functions/api/auth/login.js"
import { onRequestPost as __api_auth_logout_js_onRequestPost } from "/workspace/spades/functions/api/auth/logout.js"
import { onRequestGet as __api_auth_me_js_onRequestGet } from "/workspace/spades/functions/api/auth/me.js"
import { onRequestPost as __api_auth_register_js_onRequestPost } from "/workspace/spades/functions/api/auth/register.js"
import { onRequestPost as __api_auth_resend_js_onRequestPost } from "/workspace/spades/functions/api/auth/resend.js"
import { onRequestGet as __api_img__id__js_onRequestGet } from "/workspace/spades/functions/api/img/[id].js"
import { onRequestGet as __api_live_js_onRequestGet } from "/workspace/spades/functions/api/live.js"
import { onRequestGet as __api_messages_js_onRequestGet } from "/workspace/spades/functions/api/messages.js"
import { onRequestPost as __api_messages_js_onRequestPost } from "/workspace/spades/functions/api/messages.js"
import { onRequestGet as __api_pin_js_onRequestGet } from "/workspace/spades/functions/api/pin.js"
import { onRequestPost as __api_pin_js_onRequestPost } from "/workspace/spades/functions/api/pin.js"
import { onRequest as __api_count_js_onRequest } from "/workspace/spades/functions/api/count.js"

export const routes = [
    {
      routePath: "/api/auth/confirm",
      mountPath: "/api/auth",
      method: "GET",
      middlewares: [],
      modules: [__api_auth_confirm_js_onRequestGet],
    },
  {
      routePath: "/api/auth/login",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_login_js_onRequestPost],
    },
  {
      routePath: "/api/auth/logout",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_logout_js_onRequestPost],
    },
  {
      routePath: "/api/auth/me",
      mountPath: "/api/auth",
      method: "GET",
      middlewares: [],
      modules: [__api_auth_me_js_onRequestGet],
    },
  {
      routePath: "/api/auth/register",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_register_js_onRequestPost],
    },
  {
      routePath: "/api/auth/resend",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_resend_js_onRequestPost],
    },
  {
      routePath: "/api/img/:id",
      mountPath: "/api/img",
      method: "GET",
      middlewares: [],
      modules: [__api_img__id__js_onRequestGet],
    },
  {
      routePath: "/api/live",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_live_js_onRequestGet],
    },
  {
      routePath: "/api/messages",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_messages_js_onRequestGet],
    },
  {
      routePath: "/api/messages",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_messages_js_onRequestPost],
    },
  {
      routePath: "/api/pin",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_pin_js_onRequestGet],
    },
  {
      routePath: "/api/pin",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_pin_js_onRequestPost],
    },
  {
      routePath: "/api/count",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_count_js_onRequest],
    },
  ]