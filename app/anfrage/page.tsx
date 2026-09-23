import {Page} from '@/components/site-chrome';
import InquiryForm from '@/components/inquiry-form';
export const metadata={title:'Projektanfrage',alternates:{canonical:'/anfrage'}};
export default function Inquiry(){return <Page eyebrow="Projektanfrage" title="Aus Ihrer Idee wird ein Projekt." intro="Schritt für Schritt zu Ihrer unverbindlichen Anfrage. Sie kennen noch nicht alle Details? Wir finden sie gemeinsam."><section className="content-section intake-section"><InquiryForm/></section></Page>}
