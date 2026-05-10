import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <SignIn
      appearance={{
        variables: {
          colorPrimary: "#7c3aed",
          colorBackground: "#18181b",
          colorText: "#ffffff",
          colorTextSecondary: "#a1a1aa",
          colorInputBackground: "#27272a",
          colorInputText: "#ffffff",
        },
      }}
    />
  );
}
