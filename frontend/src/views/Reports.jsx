import { Empty, PageHead, ShellNotice, TagShell } from "../components/ui.jsx";

export default function Reports() {
  return (
    <>
      <PageHead title="Reports" sub="Exports and scheduled reporting." right={<TagShell />} />
      <ShellNotice>Reporting isn't built yet.</ShellNotice>
      <div className="card">
        <Empty>Nothing to show — this screen is a placeholder in the navigation only.</Empty>
      </div>
    </>
  );
}
