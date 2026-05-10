import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <SignUp
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
