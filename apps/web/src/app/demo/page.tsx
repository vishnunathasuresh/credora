import { demoCatalog } from '@credora/demo-data';
import { ArrowUpRightIcon } from '../../components/icons';

export default function DemoPage() {
  return (
    <main className="page-width demo-page">
      <h1>Five institutions. One open protocol.</h1>
      <p className="lede">
        Explore sample organizations, courses, certifications, and learner records across IITs,
        NITs, and IIITs. These records are synthetic fixtures; a credential becomes verified only
        after a real testnet transaction and Filebase CID are attached.
      </p>
      <div className="demo-disclaimer" role="note">
        <strong>Demo data only</strong>
        <span>{demoCatalog.disclaimer}</span>
      </div>
      <div className="demo-grid">
        {demoCatalog.organizations.map((organization) => (
          <article className="demo-org" key={organization.id}>
            <div className="demo-org-topline">
              <span className="demo-badge">{organization.category}</span>
              <span>{organization.city}</span>
            </div>
            <h2>{organization.shortName}</h2>
            <p>{organization.name}</p>
            <a className="text-link" href={organization.website} target="_blank" rel="noreferrer">
              Institution website <ArrowUpRightIcon />
            </a>
            <div className="demo-programs">
              <div className="demo-program-group">
                <div className="demo-section-label">Sample courses</div>
                {organization.courses.map((course) => (
                  <div className="demo-program" key={course.id}>
                    <div>
                      <strong>{course.name}</strong>
                      <span>
                        {course.code} · {course.level} · {course.duration}
                      </span>
                    </div>
                    <small>{course.credits} cr</small>
                  </div>
                ))}
              </div>
              <div className="demo-program-group">
                <div className="demo-section-label">Sample certifications</div>
                {organization.certifications.map((certification) => (
                  <div className="demo-program" key={certification.id}>
                    <div>
                      <strong>{certification.name}</strong>
                      <span>
                        {certification.level} · {certification.assessment}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {organization.learners.map((learner) => (
              <div className="demo-learner" key={learner.id}>
                <div className="demo-learner-heading">
                  <strong>{learner.displayName}</strong>
                  <code>
                    {learner.walletAddress.slice(0, 8)}…{learner.walletAddress.slice(-6)}
                  </code>
                </div>
                <div className="demo-credentials">
                  {learner.credentials.map((credential) => (
                    <div className="demo-credential" key={credential.id}>
                      <div>
                        <strong>{credential.skillName}</strong>
                        <span>
                          {credential.skillLevel} · issued {credential.issueDate}
                        </span>
                      </div>
                      <div className="demo-marks">
                        <strong>{credential.marks.grade}</strong>
                        <span>
                          {credential.marks.scored}/{credential.marks.maximum}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </article>
        ))}
      </div>
    </main>
  );
}
