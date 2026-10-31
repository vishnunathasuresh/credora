import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type {
  ProfileCredentialSummary,
  ProfileEducation,
  ProfileExperience,
  ProfileProject,
} from '@credora/shared';
import { credoraApi, type ApiError } from '../lib/credora-api';
import { accountApi, type AccountProfileResponse } from '../lib/account-api';
import {
  accountAuthConfigured,
  signOutAccount,
  subscribeAccountSession,
  type AccountSession,
} from '../lib/account-session';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { ProfileShare } from './profile-share';
import type { PublicProfileResult } from '../lib/public-profile.server';

export type Profile = {
  id: string;
  handle: string;
  name: string;
  headline: string;
  bio: string;
  links: string[];
  avatarUrl: string;
  projects: ProfileProject[];
  experience: ProfileExperience[];
  education: ProfileEducation[];
  credentialHashes: string[];
  credentialSummaries?: ProfileCredentialSummary[];
  published: boolean;
};
type Credential = {
  credential_hash: string;
  skill_name: string;
  organization_name: string | null;
};

const emptyProfile: Profile = {
  id: '',
  handle: '',
  name: '',
  headline: '',
  bio: '',
  links: [],
  avatarUrl: '',
  projects: [],
  experience: [],
  education: [],
  credentialHashes: [],
  published: false,
};

function normalizeProfile(profile: Profile | null): Profile {
  return {
    ...emptyProfile,
    ...(profile ?? {}),
    links: profile?.links ?? [],
    avatarUrl: profile?.avatarUrl ?? '',
    projects: profile?.projects ?? [],
    experience: profile?.experience ?? [],
    education: profile?.education ?? [],
    credentialHashes: profile?.credentialHashes ?? [],
    credentialSummaries: profile?.credentialSummaries ?? [],
  };
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function newId() {
  return crypto.randomUUID();
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

function ReorderButtons({
  label,
  index,
  count,
  onMove,
  onRemove,
}: {
  label: string;
  index: number;
  count: number;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="profile-entry-actions flex flex-wrap items-center gap-2">
      <span className="sr-only">
        {label}, position {index + 1} of {count}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={`Move ${label} up`}
        disabled={index === 0}
        onClick={() => onMove(-1)}
      >
        Move up
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={`Move ${label} down`}
        disabled={index === count - 1}
        onClick={() => onMove(1)}
      >
        Move down
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
        Remove
      </Button>
    </div>
  );
}

function ProfileField({
  id,
  label,
  value,
  onChange,
  maxLength,
  placeholder,
  type = 'text',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function ProfileTextField({
  id,
  label,
  value,
  onChange,
  maxLength,
  rows = 3,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  rows?: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={value}
        maxLength={maxLength}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function ProfileEditor() {
  const [session, setSession] = useState<AccountSession>();
  const [authResolved, setAuthResolved] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [publishedProfile, setPublishedProfile] = useState<{ handle: string; name: string }>();
  const requestVersion = useRef(0);
  const loadedUser = useRef<string | undefined>(undefined);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [links, setLinks] = useState('');
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [linkedWalletCount, setLinkedWalletCount] = useState(0);
  const [savedHandle, setSavedHandle] = useState('');
  const [handleCheck, setHandleCheck] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'unavailable'
  >('idle');
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [avatarPreviewFailed, setAvatarPreviewFailed] = useState(false);

  async function load() {
    const version = ++requestVersion.current;
    setLoading(true);
    setLoaded(false);
    setError('');
    try {
      const [result, items] = await Promise.all([
        accountApi<AccountProfileResponse<Profile>>('/account'),
        accountApi<{ items: Credential[] }>('/account/credentials'),
      ]);
      if (version !== requestVersion.current) return;
      const next = normalizeProfile(result.profile);
      setProfile(next);
      setPublishedProfile(next.published ? { handle: next.handle, name: next.name } : undefined);
      setLinks(next.links.join('\n'));
      setSavedHandle(next.handle.toLowerCase());
      setAvatarPreviewFailed(false);
      setCredentials(items.items);
      setLinkedWalletCount(result.wallets.length);
      setLoaded(true);
    } catch (cause) {
      if (version === requestVersion.current) setError((cause as Error).message);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    if (!accountAuthConfigured()) {
      setAuthResolved(true);
      return;
    }
    void subscribeAccountSession((current) => {
      if (!active) return;
      setSession(current);
      setAuthResolved(true);
      if (current?.user.id === loadedUser.current) return;
      loadedUser.current = current?.user.id;
      ++requestVersion.current;
      setProfile(emptyProfile);
      setPublishedProfile(undefined);
      setPreviewMode(false);
      setLinks('');
      setLoaded(false);
      setCredentials([]);
      setLinkedWalletCount(0);
      if (current)
        setTimeout(() => {
          if (active) void load();
        }, 0);
    })
      .then((stop) => {
        if (active) unsubscribe = stop;
        else stop();
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Account sign-in is unavailable.');
          setAuthResolved(true);
        }
      });
    return () => {
      active = false;
      ++requestVersion.current;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    const handle = profile.handle.trim().toLowerCase();
    if (!session || !handle || handle === savedHandle) {
      setHandleCheck('idle');
      return;
    }
    if (!/^[a-z0-9_]{3,30}$/.test(handle)) {
      setHandleCheck('invalid');
      return;
    }
    let active = true;
    const controller = new AbortController();
    setHandleCheck('checking');
    const timer = setTimeout(() => {
      void accountApi<{ available: boolean }>(`/account/handles/${encodeURIComponent(handle)}`, {
        signal: controller.signal,
      })
        .then((result) => {
          if (active) setHandleCheck(result.available ? 'available' : 'taken');
        })
        .catch((cause: ApiError) => {
          if (active) setHandleCheck(cause.status === 400 ? 'invalid' : 'unavailable');
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [profile.handle, savedHandle, session?.user.id]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!session || !loaded || loading) return;
    if (profile.avatarUrl && !isHttpsUrl(profile.avatarUrl)) {
      setError('Use an HTTPS URL for your profile photo.');
      return;
    }
    const version = requestVersion.current;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const result = await accountApi<{ profile: Profile }>(
        '/account/profile',
        {
          method: 'PUT',
          body: JSON.stringify({
            ...profile,
            published: profile.id ? profile.published : false,
            links: links
              .split('\n')
              .map((link) => link.trim())
              .filter(Boolean),
          }),
        },
        session.user.id,
      );
      if (version !== requestVersion.current) return;
      const next = normalizeProfile(result.profile);
      setProfile(next);
      setPublishedProfile(next.published ? { handle: next.handle, name: next.name } : undefined);
      setLinks(next.links.join('\n'));
      setSavedHandle(next.handle.toLowerCase());
      setMessage('Profile saved.');
    } catch (cause) {
      if (version === requestVersion.current) setError((cause as Error).message);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }

  function updateProject(id: string, patch: Partial<ProfileProject>) {
    setProfile((current) => ({
      ...current,
      projects: current.projects.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }

  function updateExperience(id: string, patch: Partial<ProfileExperience>) {
    setProfile((current) => ({
      ...current,
      experience: current.experience.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }

  function updateEducation(id: string, patch: Partial<ProfileEducation>) {
    setProfile((current) => ({
      ...current,
      education: current.education.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }

  const featuredCredentials = profile.credentialHashes.map((hash) => ({
    hash,
    credential: credentials.find((item) => item.credential_hash.toLowerCase() === hash),
  }));

  if (previewMode && loaded)
    return (
      <main className="page-width workspace-page">
        <header className="app-page-header">
          <div>
            <h1>Preview your profile</h1>
            <p>Only you can see these unsaved changes.</p>
          </div>
          <Button variant="outline" onClick={() => setPreviewMode(false)}>
            Back to editing
          </Button>
        </header>
        <PublicProfile
          key={profile.handle}
          handle={profile.handle}
          preview
          initial={{
            state: 'found',
            profile: {
              ...profile,
              links: links
                .split('\n')
                .map((link) => link.trim())
                .filter(Boolean),
              credentialSummaries: profile.credentialHashes.map((hash) => {
                const credential = credentials.find(
                  (item) => item.credential_hash.toLowerCase() === hash.toLowerCase(),
                );
                return {
                  credentialHash: hash,
                  skillName: credential?.skill_name ?? '',
                  organizationName: credential?.organization_name ?? null,
                  skillLevel: '',
                  issueDate: '',
                };
              }),
            },
          }}
        />
      </main>
    );

  return (
    <main className="page-width workspace-page">
      <header className="app-page-header">
        <div>
          <h1>{loaded && !profile.id ? 'Claim your handle' : 'Edit your profile'}</h1>
          <p>
            {loaded && !profile.id
              ? 'Start with your name and handle. Your profile stays private.'
              : 'Your story, work, and issuer-backed achievements.'}
          </p>
        </div>
        {loaded && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" type="button" onClick={() => setPreviewMode(true)}>
              Preview profile
            </Button>
            {publishedProfile && (
              <ProfileShare handle={publishedProfile.handle} name={publishedProfile.name} />
            )}
            <Button
              variant="ghost"
              onClick={() => void signOutAccount().catch((cause: Error) => setError(cause.message))}
            >
              Sign out
            </Button>
          </div>
        )}
      </header>
      {error && (
        <p role="alert" className="form-help form-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="form-help">
          {message}
        </p>
      )}
      {!authResolved ? (
        <p role="status">Checking your account…</p>
      ) : !session ? (
        <section className="workspace-panel app-connect-state">
          <h2>Your professional identity starts here.</h2>
          <p>Choose your handle and build your profile. Add credentials when you’re ready.</p>
          <Button asChild>
            <Link to="/join">Continue with Google</Link>
          </Button>
        </section>
      ) : !loaded ? (
        <div className="workspace-panel app-empty-state" role={loading ? 'status' : undefined}>
          <p>{loading ? 'Loading your profile…' : 'Your profile could not be loaded.'}</p>
          {!loading && (
            <Button variant="outline" onClick={() => void load()}>
              Try loading again
            </Button>
          )}
        </div>
      ) : (
        <form onSubmit={save} className="workspace-form profile-editor-form">
          <section className="workspace-panel" aria-labelledby="profile-identity-title">
            <h2 id="profile-identity-title">Profile identity</h2>
            <div className="profile-section-grid grid gap-6 sm:grid-cols-[minmax(0,1fr)_14rem]">
              <div className="flex flex-col gap-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <ProfileField
                    id="profile-name"
                    label="Name"
                    value={profile.name}
                    maxLength={100}
                    onChange={(name) => setProfile({ ...profile, name })}
                  />
                  <div className="flex flex-col gap-2">
                    <ProfileField
                      id="profile-handle"
                      label="Handle"
                      value={profile.handle}
                      maxLength={30}
                      onChange={(handle) => setProfile({ ...profile, handle })}
                    />
                    <p role="status" className="text-sm text-muted-foreground">
                      {
                        {
                          idle: '',
                          checking: 'Checking availability…',
                          available: 'This handle is available.',
                          taken: 'This handle is taken.',
                          invalid:
                            'Choose 3–30 letters, numbers or underscores. System names are reserved.',
                          unavailable: 'Availability could not be checked. You can try saving.',
                        }[handleCheck]
                      }
                    </p>
                    <p className="text-sm text-muted-foreground">
                      3–30 letters, numbers or underscores. Changes are limited to once every 30
                      days.
                    </p>
                  </div>
                </div>
                <ProfileField
                  id="profile-headline"
                  label="Headline"
                  value={profile.headline}
                  maxLength={160}
                  onChange={(headline) => setProfile({ ...profile, headline })}
                />
                {profile.id && (
                  <ProfileTextField
                    id="profile-bio"
                    label="About"
                    value={profile.bio}
                    maxLength={1000}
                    rows={5}
                    onChange={(bio) => setProfile({ ...profile, bio })}
                  />
                )}
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor="profile-avatar-url">Photo URL</Label>
                <Input
                  id="profile-avatar-url"
                  type="url"
                  inputMode="url"
                  placeholder="https://example.com/photo.jpg"
                  value={profile.avatarUrl}
                  onChange={(event) => {
                    setProfile({ ...profile, avatarUrl: event.target.value });
                    setAvatarPreviewFailed(false);
                  }}
                />
                <div className="profile-avatar-preview" aria-label="Profile photo preview">
                  {profile.avatarUrl && isHttpsUrl(profile.avatarUrl) && !avatarPreviewFailed ? (
                    <img
                      className="profile-avatar-image"
                      src={profile.avatarUrl}
                      alt=""
                      width={160}
                      height={160}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarPreviewFailed(true)}
                    />
                  ) : (
                    <span className="profile-avatar-fallback" aria-hidden="true">
                      {initials(profile.name) || '?'}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Use an HTTPS image URL. The image host can see requests from people who view your
                  public profile.
                </p>
              </div>
            </div>
            {profile.id && (
              <div className="mt-6 flex flex-col gap-2">
                <Label htmlFor="profile-links">Links</Label>
                <Textarea
                  id="profile-links"
                  rows={3}
                  value={links}
                  onChange={(event) => setLinks(event.target.value)}
                />
                <p className="text-sm text-muted-foreground">One full URL per line, up to 10.</p>
              </div>
            )}
          </section>

          {!profile.id && (
            <div className="flex flex-wrap items-center gap-4">
              <Button
                disabled={
                  loading ||
                  !profile.name.trim() ||
                  !/^[a-z0-9_]{3,30}$/i.test(profile.handle.trim()) ||
                  handleCheck === 'taken' ||
                  handleCheck === 'invalid'
                }
              >
                {loading ? 'Saving…' : 'Claim handle and continue'}
              </Button>
              <Link className="text-link" to="/settings/wallets">
                Import an existing wallet profile
              </Link>
            </div>
          )}
          {profile.id && (
            <>
              <section className="workspace-panel" aria-labelledby="profile-projects-title">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 id="profile-projects-title">Projects</h2>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={profile.projects.length >= 8}
                    onClick={() =>
                      setProfile({
                        ...profile,
                        projects: [
                          ...profile.projects,
                          { id: newId(), name: '', description: '', url: '' },
                        ],
                      })
                    }
                  >
                    Add project
                  </Button>
                </div>
                {profile.projects.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Add work you would like people to see.
                  </p>
                )}
                <div className="grid gap-4">
                  {profile.projects.map((project, index) => (
                    <fieldset
                      className="profile-editor-entry rounded-lg border p-4"
                      key={project.id}
                    >
                      <legend className="px-1 font-medium">Project {index + 1}</legend>
                      <div className="grid gap-4">
                        <ProfileField
                          id={`project-${project.id}-name`}
                          label="Project name"
                          value={project.name}
                          maxLength={120}
                          onChange={(name) => updateProject(project.id, { name })}
                        />
                        <ProfileTextField
                          id={`project-${project.id}-description`}
                          label="Description"
                          value={project.description}
                          maxLength={1000}
                          onChange={(description) => updateProject(project.id, { description })}
                        />
                        <ProfileField
                          id={`project-${project.id}-url`}
                          label="Project URL"
                          type="url"
                          value={project.url}
                          onChange={(url) => updateProject(project.id, { url })}
                        />
                        <ReorderButtons
                          label={project.name || `project ${index + 1}`}
                          index={index}
                          count={profile.projects.length}
                          onMove={(direction) =>
                            setProfile({
                              ...profile,
                              projects: moveItem(profile.projects, index, direction),
                            })
                          }
                          onRemove={() =>
                            setProfile({
                              ...profile,
                              projects: profile.projects.filter((item) => item.id !== project.id),
                            })
                          }
                        />
                      </div>
                    </fieldset>
                  ))}
                </div>
              </section>

              <section className="workspace-panel" aria-labelledby="profile-experience-title">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 id="profile-experience-title">Experience</h2>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={profile.experience.length >= 8}
                    onClick={() =>
                      setProfile({
                        ...profile,
                        experience: [
                          ...profile.experience,
                          { id: newId(), role: '', organization: '', period: '', description: '' },
                        ],
                      })
                    }
                  >
                    Add experience
                  </Button>
                </div>
                <div className="grid gap-4">
                  {profile.experience.map((experience, index) => (
                    <fieldset
                      className="profile-editor-entry rounded-lg border p-4"
                      key={experience.id}
                    >
                      <legend className="px-1 font-medium">Role {index + 1}</legend>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <ProfileField
                          id={`experience-${experience.id}-role`}
                          label="Role"
                          value={experience.role}
                          onChange={(role) => updateExperience(experience.id, { role })}
                        />
                        <ProfileField
                          id={`experience-${experience.id}-organization`}
                          label="Organization"
                          value={experience.organization}
                          onChange={(organization) =>
                            updateExperience(experience.id, { organization })
                          }
                        />
                        <ProfileField
                          id={`experience-${experience.id}-period`}
                          label="Period"
                          value={experience.period}
                          placeholder="2023 – Present"
                          onChange={(period) => updateExperience(experience.id, { period })}
                        />
                        <ProfileTextField
                          id={`experience-${experience.id}-description`}
                          label="Description"
                          value={experience.description}
                          onChange={(description) =>
                            updateExperience(experience.id, { description })
                          }
                        />
                        <ReorderButtons
                          label={experience.role || `role ${index + 1}`}
                          index={index}
                          count={profile.experience.length}
                          onMove={(direction) =>
                            setProfile({
                              ...profile,
                              experience: moveItem(profile.experience, index, direction),
                            })
                          }
                          onRemove={() =>
                            setProfile({
                              ...profile,
                              experience: profile.experience.filter(
                                (item) => item.id !== experience.id,
                              ),
                            })
                          }
                        />
                      </div>
                    </fieldset>
                  ))}
                </div>
              </section>

              <section className="workspace-panel" aria-labelledby="profile-education-title">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 id="profile-education-title">Education</h2>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={profile.education.length >= 8}
                    onClick={() =>
                      setProfile({
                        ...profile,
                        education: [
                          ...profile.education,
                          { id: newId(), school: '', degree: '', period: '', description: '' },
                        ],
                      })
                    }
                  >
                    Add education
                  </Button>
                </div>
                <div className="grid gap-4">
                  {profile.education.map((education, index) => (
                    <fieldset
                      className="profile-editor-entry rounded-lg border p-4"
                      key={education.id}
                    >
                      <legend className="px-1 font-medium">Education {index + 1}</legend>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <ProfileField
                          id={`education-${education.id}-school`}
                          label="School"
                          value={education.school}
                          onChange={(school) => updateEducation(education.id, { school })}
                        />
                        <ProfileField
                          id={`education-${education.id}-degree`}
                          label="Degree or program"
                          value={education.degree}
                          onChange={(degree) => updateEducation(education.id, { degree })}
                        />
                        <ProfileField
                          id={`education-${education.id}-period`}
                          label="Period"
                          value={education.period}
                          placeholder="2021 – 2025"
                          onChange={(period) => updateEducation(education.id, { period })}
                        />
                        <ProfileTextField
                          id={`education-${education.id}-description`}
                          label="Description"
                          value={education.description}
                          onChange={(description) => updateEducation(education.id, { description })}
                        />
                        <ReorderButtons
                          label={education.school || `education ${index + 1}`}
                          index={index}
                          count={profile.education.length}
                          onMove={(direction) =>
                            setProfile({
                              ...profile,
                              education: moveItem(profile.education, index, direction),
                            })
                          }
                          onRemove={() =>
                            setProfile({
                              ...profile,
                              education: profile.education.filter(
                                (item) => item.id !== education.id,
                              ),
                            })
                          }
                        />
                      </div>
                    </fieldset>
                  ))}
                </div>
              </section>

              <section className="workspace-panel" aria-labelledby="profile-featured-title">
                <fieldset className="flex flex-col gap-3">
                  <legend id="profile-featured-title" className="text-lg font-semibold">
                    Featured credentials
                  </legend>
                  <p className="text-sm text-muted-foreground">
                    Choose which issuer-backed credentials appear on your public profile.
                  </p>
                  {credentials.length === 0 && (
                    <p className="text-sm text-muted-foreground">No credentials available yet.</p>
                  )}
                  {credentials.map((item) => {
                    const hash = item.credential_hash.toLowerCase();
                    const checked = profile.credentialHashes.includes(hash);
                    return (
                      <label
                        key={item.credential_hash}
                        className="flex min-h-11 items-center gap-3 rounded-md border p-3"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setProfile({
                              ...profile,
                              credentialHashes: event.target.checked
                                ? [...profile.credentialHashes, hash]
                                : profile.credentialHashes.filter((value) => value !== hash),
                            })
                          }
                        />
                        <span className="min-w-0 break-all">
                          {item.skill_name || item.credential_hash}
                          {item.organization_name ? ` · ${item.organization_name}` : ''}
                        </span>
                      </label>
                    );
                  })}
                  {featuredCredentials.map(({ hash, credential }, index) => {
                    return (
                      <div
                        key={`featured-${hash}`}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/50 p-3"
                      >
                        <span className="min-w-0 break-all">
                          {credential?.skill_name || `Credential ${hash.slice(0, 10)}…`}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            aria-label={`Move ${credential?.skill_name || 'credential'} up`}
                            disabled={index === 0}
                            onClick={() =>
                              setProfile({
                                ...profile,
                                credentialHashes: moveItem(profile.credentialHashes, index, -1),
                              })
                            }
                          >
                            Move up
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            aria-label={`Move ${credential?.skill_name || 'credential'} down`}
                            disabled={index === featuredCredentials.length - 1}
                            onClick={() =>
                              setProfile({
                                ...profile,
                                credentialHashes: moveItem(profile.credentialHashes, index, 1),
                              })
                            }
                          >
                            Move down
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </fieldset>
              </section>

              <section className="workspace-panel" aria-labelledby="profile-publication-title">
                <h2 id="profile-publication-title">Publication</h2>
                <label className="flex items-start gap-3 rounded-md border p-4">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={profile.published}
                    onChange={(event) =>
                      setProfile({ ...profile, published: event.target.checked })
                    }
                  />
                  <span>
                    <strong>Publish profile</strong>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      Publishing can connect your identity to public wallet records. Unpublishing
                      removes this page but cannot remove public proofs or copies.
                    </span>
                  </span>
                </label>
                <div className="flex flex-wrap items-center gap-4">
                  <Button className="min-h-11" disabled={loading || !loaded}>
                    {loading ? 'Saving…' : 'Save profile'}
                  </Button>
                  {publishedProfile && (
                    <Link
                      className="text-primary underline"
                      to="/u/$handle"
                      params={{ handle: publishedProfile.handle }}
                    >
                      View public profile
                    </Link>
                  )}
                </div>
              </section>
            </>
          )}
        </form>
      )}
    </main>
  );
}

function PublicAvatar({ profile }: { profile: Profile }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [profile.avatarUrl]);
  return (
    <div className="public-profile-avatar">
      {profile.avatarUrl && isHttpsUrl(profile.avatarUrl) && !failed ? (
        <img
          className="public-profile-avatar-image"
          src={profile.avatarUrl}
          alt={`${profile.name}'s profile photo`}
          width={160}
          height={160}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="profile-avatar-fallback" aria-hidden="true">
          {initials(profile.name) || '?'}
        </span>
      )}
    </div>
  );
}

function Description({ children }: { children: ReactNode }) {
  return <p className="whitespace-pre-wrap leading-relaxed">{children}</p>;
}

export function PublicProfile({
  handle,
  initial,
  preview = false,
}: {
  handle: string;
  initial?: PublicProfileResult;
  preview?: boolean;
}) {
  const [profile, setProfile] = useState<Profile | undefined>(
    initial?.profile ? normalizeProfile(initial.profile) : undefined,
  );
  const [state, setState] = useState<'loading' | 'found' | 'missing' | 'unavailable' | 'error'>(
    initial?.state ?? 'loading',
  );
  const isCurrentProfile = profile?.handle.toLowerCase() === handle.toLowerCase();

  useEffect(() => {
    if (initial) return;
    let active = true;
    setState('loading');
    credoraApi<{ profile: Profile | null }>(`/profiles/${encodeURIComponent(handle)}`)
      .then((result) => {
        if (active && result.profile) {
          setProfile(normalizeProfile(result.profile));
          setState('found');
        } else if (active) {
          setState('missing');
        }
      })
      .catch((error: ApiError) => {
        if (active)
          setState(
            error.status === 404 || error.status === 400
              ? 'missing'
              : error.code === 'API_UNAVAILABLE' || (error.status ?? 0) >= 500
                ? 'unavailable'
                : 'error',
          );
      });
    return () => {
      active = false;
    };
  }, [handle, initial]);

  const Container = preview ? 'div' : 'main';
  return (
    <Container className="page-width workspace-page public-profile-page">
      {(state === 'loading' || (state === 'found' && !isCurrentProfile)) && (
        <p role="status">Loading profile…</p>
      )}
      {state === 'missing' && (
        <section className="workspace-panel app-empty-state">
          <h1>Profile not found</h1>
          <p>This profile may be private or the handle may have changed.</p>
        </section>
      )}
      {state === 'unavailable' && (
        <div className="workspace-panel app-empty-state" role="alert">
          <h1 className="text-3xl font-semibold">Profile unavailable</h1>
          <p className="mt-3 text-muted-foreground">
            The profile service could not be reached. Please try again later.
          </p>
        </div>
      )}
      {state === 'error' && (
        <div className="workspace-panel app-empty-state" role="alert">
          <h1 className="text-3xl font-semibold">Could not load profile</h1>
          <p className="mt-3 text-muted-foreground">Please try again later.</p>
        </div>
      )}
      {state === 'found' && profile && isCurrentProfile && (
        <article>
          <section className="workspace-panel public-profile-hero">
            <PublicAvatar profile={profile} />
            <div className="public-profile-intro">
              <p className="profile-handle">@{profile.handle}</p>
              <h1>{profile.name}</h1>
              {profile.headline && <p className="public-profile-headline">{profile.headline}</p>}
            </div>
            {!preview && <ProfileShare handle={profile.handle} name={profile.name} />}
          </section>
          {(profile.bio ||
            profile.links.length > 0 ||
            profile.experience.length > 0 ||
            profile.education.length > 0 ||
            profile.projects.length > 0) && (
            <div className="profile-public-claims">
              {profile.bio && (
                <section className="profile-content-section">
                  <h2>About</h2>
                  <Description>{profile.bio}</Description>
                </section>
              )}
              {profile.links.length > 0 && (
                <section className="profile-content-section" aria-label="Links">
                  <ul className="profile-links">
                    {profile.links.map((link) => (
                      <li key={link}>
                        <a
                          className="text-link break-all"
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          title={link}
                        >
                          {(() => {
                            try {
                              return new URL(link).hostname;
                            } catch {
                              return link;
                            }
                          })()}
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {profile.experience.length > 0 && (
                <section className="profile-content-section">
                  <h2>Experience</h2>
                  <ol className="profile-timeline">
                    {profile.experience.map((experience) => (
                      <li className="profile-timeline-item" key={experience.id}>
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <h3>{experience.role}</h3>
                          <p className="text-sm text-muted-foreground">{experience.period}</p>
                        </div>
                        <p className="text-muted-foreground">{experience.organization}</p>
                        {experience.description && (
                          <Description>{experience.description}</Description>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>
              )}
              {profile.education.length > 0 && (
                <section className="profile-content-section">
                  <h2>Education</h2>
                  <ol className="profile-timeline">
                    {profile.education.map((education) => (
                      <li className="profile-timeline-item" key={education.id}>
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <h3>{education.school}</h3>
                          <p className="text-sm text-muted-foreground">{education.period}</p>
                        </div>
                        <p className="text-muted-foreground">{education.degree}</p>
                        {education.description && (
                          <Description>{education.description}</Description>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>
              )}
              {profile.projects.length > 0 && (
                <section className="profile-content-section">
                  <h2>Projects</h2>
                  <div className="profile-project-grid grid gap-4 sm:grid-cols-2">
                    {profile.projects.map((project) => (
                      <article
                        className="profile-project-card rounded-lg border p-5"
                        key={project.id}
                      >
                        <h3>{project.name}</h3>
                        {project.description && <Description>{project.description}</Description>}
                        {project.url && (
                          <a
                            className="text-link break-all"
                            href={project.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Visit project
                          </a>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
          {profile.credentialHashes.length > 0 && (
            <section className="profile-content-section">
              <h2>Issuer-backed credentials</h2>
              <div className="profile-featured-list grid gap-3">
                {profile.credentialHashes.map((hash) => {
                  const summary = profile.credentialSummaries?.find(
                    (item) => item.credentialHash.toLowerCase() === hash.toLowerCase(),
                  );
                  return (
                    <article className="rounded-lg border p-4" key={hash}>
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3>{summary?.skillName || `Credential ${hash.slice(0, 10)}…`}</h3>
                          {summary?.organizationName && (
                            <p className="text-muted-foreground">{summary.organizationName}</p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            {summary?.skillLevel && <span>{summary.skillLevel}</span>}
                            {summary?.issueDate && <time>{summary.issueDate}</time>}
                            {!summary && <span>Reference {hash.slice(0, 10)}…</span>}
                          </div>
                        </div>
                        <Link
                          className="min-h-11 shrink-0 text-primary underline"
                          to="/verify/$credentialRef"
                          params={{ credentialRef: hash }}
                        >
                          View credential
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </article>
      )}
    </Container>
  );
}
