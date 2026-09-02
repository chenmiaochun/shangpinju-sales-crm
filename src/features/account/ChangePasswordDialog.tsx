import { useState } from "react";
import { CheckCircle2, KeyRound, Loader2, X } from "lucide-react";
import { salesApi } from "../../api/salesApi";
import "./account.css";

interface Props {
  onClose: () => void;
}

/**
 * 员工自助修改密码。
 * 必须验证当前密码；修改成功后本设备保持登录，其他设备会话会被踢下线。
 */
export function ChangePasswordDialog({ onClose }: Props) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError("");
    if (!oldPassword || !newPassword) {
      setError("请填写当前密码和新密码");
      return;
    }
    if (newPassword !== confirm) {
      setError("两次输入的新密码不一致");
      return;
    }
    const valid = /^\d{6}$/.test(newPassword) || newPassword.length >= 10;
    if (!valid) {
      setError("新密码需为 6 位数字，或 10 位以上字符");
      return;
    }
    setBusy(true);
    try {
      await salesApi.changePassword(oldPassword, newPassword);
      setDone(true);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      setError(
        message.includes("401")
          ? "登录已过期，请重新登录后再修改密码"
          : message || "修改失败，请稍后再试",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="cp-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section role="dialog" aria-label="修改密码" className="cp-dialog">
        <header>
          <h2>
            <KeyRound size={17} />
            修改密码
          </h2>
          <button type="button" aria-label="关闭" onClick={onClose}>
            <X size={17} />
          </button>
        </header>

        {done ? (
          <div className="cp-done">
            <CheckCircle2 size={30} />
            <p>密码已修改</p>
            <small>本设备保持登录；其他设备需要重新登录。</small>
            <button type="button" className="cp-primary" onClick={onClose}>
              完成
            </button>
          </div>
        ) : (
          <>
            <label>
              <span>当前密码</span>
              <input
                type="password"
                value={oldPassword}
                autoComplete="current-password"
                onChange={(event) => setOldPassword(event.target.value)}
                placeholder="请输入当前使用的密码"
              />
            </label>
            <label>
              <span>新密码</span>
              <input
                type="password"
                value={newPassword}
                autoComplete="new-password"
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="6 位数字，或 10 位以上字符"
              />
            </label>
            <label>
              <span>确认新密码</span>
              <input
                type="password"
                value={confirm}
                autoComplete="new-password"
                onChange={(event) => setConfirm(event.target.value)}
                placeholder="再输入一次新密码"
              />
            </label>
            {error && <p className="cp-error">{error}</p>}
            <footer>
              <button type="button" className="cp-ghost" onClick={onClose}>
                取消
              </button>
              <button
                type="button"
                className="cp-primary"
                onClick={() => void submit()}
                disabled={busy}
              >
                {busy ? <Loader2 size={15} className="spin" /> : null}
                {busy ? "提交中…" : "确认修改"}
              </button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
