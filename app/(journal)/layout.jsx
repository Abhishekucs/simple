import JournalPage from "../../components/journal-page";

export default function JournalLayout({ children }) {
  return (
    <>
      <JournalPage />
      {children}
    </>
  );
}
