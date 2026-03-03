"use node";

import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
  Link,
} from "@react-email/components";
import { render } from "@react-email/render";
import * as React from "react";

// ── Shared styles ───────────────────────────────────────────────────

const main: React.CSSProperties = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
  borderRadius: "8px",
  border: "1px solid #e6ebf1",
};

const heading: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: "bold",
  color: "#1a1a1a",
  padding: "0 48px",
  margin: "32px 0 0",
};

const paragraph: React.CSSProperties = {
  fontSize: "16px",
  lineHeight: "26px",
  color: "#525f7f",
  padding: "0 48px",
};

const button: React.CSSProperties = {
  backgroundColor: "#18181b",
  borderRadius: "6px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  padding: "12px 24px",
  margin: "24px 48px",
};

const footer: React.CSSProperties = {
  fontSize: "13px",
  color: "#8898aa",
  padding: "0 48px",
};

const hr: React.CSSProperties = {
  borderColor: "#e6ebf1",
  margin: "20px 0",
};

// ── Base layout ─────────────────────────────────────────────────────

function BaseLayout({
  preview,
  children,
}: {
  preview: string;
  children: React.ReactNode;
}) {
  const appName = process.env.APP_NAME ?? "App";
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section>
            <Text style={{ ...heading, fontSize: "14px", fontWeight: "600", color: "#8898aa", letterSpacing: "0.5px", textTransform: "uppercase" as const }}>
              {appName}
            </Text>
          </Section>
          {children}
          <Hr style={hr} />
          <Text style={footer}>
            This email was sent by {appName}. If you didn&apos;t expect this
            email, you can safely ignore it.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// ── Template props ──────────────────────────────────────────────────

interface WelcomeProps {
  name: string;
  loginUrl: string;
}

interface PasswordResetProps {
  name: string;
  resetUrl: string;
  expiresIn: string;
}

interface EmailVerificationProps {
  name: string;
  verificationUrl: string;
}

interface MagicLinkProps {
  email: string;
  magicLinkUrl: string;
  expiresIn: string;
}

interface TeamInviteProps {
  inviterName: string;
  teamName: string;
  inviteUrl: string;
}

interface NotificationProps {
  name: string;
  title: string;
  body: string;
  actionUrl?: string;
  actionLabel?: string;
}

interface AccountDeletionProps {
  name: string;
  deletionDate: string;
}

// ── Templates ───────────────────────────────────────────────────────

function WelcomeEmail({ name, loginUrl }: WelcomeProps) {
  return (
    <BaseLayout preview={`Welcome, ${name}!`}>
      <Text style={heading}>Welcome, {name}!</Text>
      <Text style={paragraph}>
        Thanks for signing up. We&apos;re excited to have you on board. Click
        below to get started.
      </Text>
      <Button style={button} href={loginUrl}>
        Go to Dashboard
      </Button>
    </BaseLayout>
  );
}

function PasswordResetEmail({ name, resetUrl, expiresIn }: PasswordResetProps) {
  return (
    <BaseLayout preview="Reset your password">
      <Text style={heading}>Reset your password</Text>
      <Text style={paragraph}>
        Hi {name}, we received a request to reset your password. Click the
        button below to choose a new one. This link expires in {expiresIn}.
      </Text>
      <Button style={button} href={resetUrl}>
        Reset Password
      </Button>
      <Text style={paragraph}>
        If you didn&apos;t request a password reset, you can safely ignore this
        email.
      </Text>
    </BaseLayout>
  );
}

function EmailVerificationEmail({
  name,
  verificationUrl,
}: EmailVerificationProps) {
  return (
    <BaseLayout preview="Verify your email">
      <Text style={heading}>Verify your email</Text>
      <Text style={paragraph}>
        Hi {name}, please verify your email address by clicking the button
        below.
      </Text>
      <Button style={button} href={verificationUrl}>
        Verify Email
      </Button>
    </BaseLayout>
  );
}

function MagicLinkEmail({ email, magicLinkUrl, expiresIn }: MagicLinkProps) {
  return (
    <BaseLayout preview="Your sign-in link">
      <Text style={heading}>Your sign-in link</Text>
      <Text style={paragraph}>
        Click the button below to sign in as {email}. This link expires in{" "}
        {expiresIn}.
      </Text>
      <Button style={button} href={magicLinkUrl}>
        Sign In
      </Button>
      <Text style={paragraph}>
        Or copy and paste this URL into your browser:{" "}
        <Link href={magicLinkUrl}>{magicLinkUrl}</Link>
      </Text>
    </BaseLayout>
  );
}

function TeamInviteEmail({
  inviterName,
  teamName,
  inviteUrl,
}: TeamInviteProps) {
  return (
    <BaseLayout preview={`${inviterName} invited you to ${teamName}`}>
      <Text style={heading}>You&apos;re invited!</Text>
      <Text style={paragraph}>
        {inviterName} invited you to join <strong>{teamName}</strong>. Click
        below to accept the invitation.
      </Text>
      <Button style={button} href={inviteUrl}>
        Accept Invitation
      </Button>
    </BaseLayout>
  );
}

function NotificationEmail({
  name,
  title,
  body,
  actionUrl,
  actionLabel,
}: NotificationProps) {
  return (
    <BaseLayout preview={title}>
      <Text style={heading}>{title}</Text>
      <Text style={paragraph}>Hi {name},</Text>
      <Text style={paragraph}>{body}</Text>
      {actionUrl && (
        <Button style={button} href={actionUrl}>
          {actionLabel ?? "View Details"}
        </Button>
      )}
    </BaseLayout>
  );
}

function AccountDeletionEmail({ name, deletionDate }: AccountDeletionProps) {
  return (
    <BaseLayout preview="Your account has been deleted">
      <Text style={heading}>Account deleted</Text>
      <Text style={paragraph}>
        Hi {name}, your account was deleted on {deletionDate}. All your data has
        been removed.
      </Text>
      <Text style={paragraph}>
        If this was a mistake or you&apos;d like to return, you&apos;re welcome
        to create a new account at any time.
      </Text>
    </BaseLayout>
  );
}

// ── Template registry ───────────────────────────────────────────────

type TemplateMap = {
  welcome: WelcomeProps;
  "password-reset": PasswordResetProps;
  "email-verification": EmailVerificationProps;
  "magic-link": MagicLinkProps;
  "team-invite": TeamInviteProps;
  notification: NotificationProps;
  "account-deletion": AccountDeletionProps;
};

type TemplateName = keyof TemplateMap;

const templates: {
  [K in TemplateName]: {
    subject: (props: TemplateMap[K]) => string;
    component: (props: TemplateMap[K]) => React.ReactElement;
  };
} = {
  welcome: {
    subject: (p) => `Welcome, ${p.name}!`,
    component: (p) => <WelcomeEmail {...p} />,
  },
  "password-reset": {
    subject: () => "Reset your password",
    component: (p) => <PasswordResetEmail {...p} />,
  },
  "email-verification": {
    subject: () => "Verify your email",
    component: (p) => <EmailVerificationEmail {...p} />,
  },
  "magic-link": {
    subject: () => "Your sign-in link",
    component: (p) => <MagicLinkEmail {...p} />,
  },
  "team-invite": {
    subject: (p) => `${p.inviterName} invited you to ${p.teamName}`,
    component: (p) => <TeamInviteEmail {...p} />,
  },
  notification: {
    subject: (p) => p.title,
    component: (p) => <NotificationEmail {...p} />,
  },
  "account-deletion": {
    subject: () => "Your account has been deleted",
    component: (p) => <AccountDeletionEmail {...p} />,
  },
};

// ── Public API ──────────────────────────────────────────────────────

export async function renderTemplate<T extends TemplateName>(
  template: T,
  props: TemplateMap[T]
): Promise<{ html: string; subject: string }> {
  const entry = templates[template];
  const subject = entry.subject(props);
  const element = entry.component(props);
  const html = await render(element);
  return { html, subject };
}
