interface AuthErrorLike {
  code?: string;
  message?: string;
}

interface SignUpDataLike {
  user: unknown | null;
  session: unknown | null;
}

export type AuthCallbackAction =
  | { kind: "exchange_code"; code: string }
  | { kind: "verify_otp"; tokenHash: string; type: string }
  | { kind: "implicit_session" }
  | { kind: "error"; message: string }
  | { kind: "none" };

export function getAuthRedirectUrl(origin: string): string {
  return new URL("/auth/confirm", origin).toString();
}

export function getAuthCallbackAction(input: string): AuthCallbackAction {
  const url = new URL(input);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  const errorMessage = url.searchParams.get("error_description") ?? hashParams.get("error_description");
  if (errorMessage) {
    return { kind: "error", message: errorMessage };
  }

  const code = url.searchParams.get("code");
  if (code) {
    return { kind: "exchange_code", code };
  }

  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (tokenHash && type) {
    return { kind: "verify_otp", tokenHash, type };
  }

  if (hashParams.get("access_token") && hashParams.get("refresh_token")) {
    return { kind: "implicit_session" };
  }

  return { kind: "none" };
}

export function getAuthErrorMessage(error: unknown): string {
  const authError = error && typeof error === "object" ? (error as AuthErrorLike) : {};
  const code = authError.code ?? "";
  const message = authError.message ?? "";
  const waitTime = message.match(/after\s+(\d+)\s+seconds?/i)?.[1];

  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || /security purposes/i.test(message)) {
    return waitTime
      ? `보안을 위해 ${waitTime}초 후 다시 시도해 주세요.`
      : "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
  }

  switch (code) {
    case "invalid_credentials":
      return "이메일 또는 비밀번호가 올바르지 않습니다.";
    case "email_not_confirmed":
      return "이메일 인증을 완료한 뒤 로그인해 주세요.";
    case "user_already_exists":
    case "email_exists":
      return "이미 가입된 이메일입니다. 로그인해 주세요.";
    case "weak_password":
      return "비밀번호는 6자 이상으로 입력해 주세요.";
    case "signup_disabled":
      return "현재 신규 회원가입이 중지되어 있습니다.";
    case "email_address_invalid":
      return "사용할 수 없는 이메일 주소입니다.";
    case "otp_expired":
      return "인증 링크가 만료되었습니다. 인증 메일을 다시 요청해 주세요.";
    default:
      return "인증 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  }
}

export function getSignUpOutcome(data: SignUpDataLike) {
  if (data.session) {
    return {
      authenticated: true,
      message: "회원가입과 로그인이 완료되었습니다.",
    };
  }

  return {
    authenticated: false,
    message: "가입 확인 메일을 보냈습니다. 이메일 인증을 완료한 뒤 로그인해 주세요.",
  };
}
