import { getWebsitePageUrl, useLocale } from '../../../shared/i18n';
import { ThemeToggleComponent } from '../../../shared/ui';

export function AuthNavbarComponent() {
  const { locale } = useLocale();

  const homePageUrl = getWebsitePageUrl('home', locale);

  return (
    <div className="flex h-[65px] items-center justify-center px-5 pt-5 sm:justify-start">
      <div className="flex items-center gap-3 hover:opacity-80">
        <a href={homePageUrl} target="_blank" rel="noreferrer">
          <img className="h-[45px] w-[45px] p-1" src="/logo.svg" />
        </a>

        <div className="text-xl font-bold">
          <a href={homePageUrl} className="!text-blue-600" target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line i18next/no-literal-string -- product name, the same in every language */}
            {'Databasus'}
          </a>
        </div>
      </div>

      <div className="mr-3 ml-auto hidden items-center gap-5 sm:flex">
        <div className="flex items-center gap-2">
          <ThemeToggleComponent />
        </div>
      </div>
    </div>
  );
}
