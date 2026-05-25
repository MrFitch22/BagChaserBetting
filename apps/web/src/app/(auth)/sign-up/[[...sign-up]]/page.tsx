import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-bold text-text">BagChaser</h1>
          <p className="mt-2 text-muted">Know who&apos;s actually winning.</p>
        </div>
        <SignUp
          appearance={{
            variables: {
              colorBackground: "#0d1119",
              colorText: "#dce4f0",
              colorPrimary: "#10b981",
              colorInputBackground: "#111824",
              colorInputText: "#dce4f0",
              borderRadius: "8px",
            },
          }}
        />
      </div>
    </div>
  );
}
