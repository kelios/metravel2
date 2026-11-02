import React from 'react';
import {render,fireEvent,screen} from '@testing-library/react';
import {ReadyBookRelatedLink} from '@/components/books/ReadyBookRelatedLink';
import {relatedBookForSource} from '@/services/book/readyBooks/related';
import {Platform} from 'react-native';
import PlaceListCard from '@/components/places/PlaceListCard';
import {trackReadyBookRelatedOpened} from '@/utils/growthFunnelAnalytics';

jest.mock('react-native',()=>({Platform:{OS:'web',select:(values:any)=>values.web??values.default},StyleSheet:{create:(styles:any)=>styles},
  Text:({children}:any)=><span>{children}</span>,View:({children}:any)=><div>{children}</div>,ActivityIndicator:()=>null}));
jest.mock('@expo/vector-icons/Feather',()=>()=>null);
jest.mock('@/hooks/useTheme',()=>({useThemedColors:()=>({})}));
jest.mock('@/components/ui/UnifiedTravelCard',()=>({__esModule:true,default:({contentSlot}:any)=><article>{contentSlot}</article>}));
jest.mock('@/components/ui/CardActionPressable',()=>({__esModule:true,default:({children}:any)=><button>{children}</button>}));
jest.mock('@/components/travel/RelatedTravelActionStack',()=>({__esModule:true,default:()=>null}));
jest.mock('@/components/places/PlaceListCard.parts',()=>({CardMeta:()=>null,LabeledActionChip:()=>null,MapActionChip:()=>null,PlaceCardOverflowControl:()=>null}));
jest.mock('@/components/places/PlaceRatingBadge',()=>({__esModule:true,default:()=>null}));
jest.mock('expo-router',()=>{
  const React=jest.requireActual<typeof import('react')>('react');
  const router={push:jest.fn()};
  return {useRouter:()=>router,Link:React.forwardRef<HTMLAnchorElement,any>(function MockLink({href,onPress,children,dataSet,accessibilityLabel},ref){return <a ref={ref} href={href} onClick={onPress} aria-label={accessibilityLabel} data-card-action={dataSet?.cardAction}>{children}</a>;})};
});
jest.mock('@/data/travelBooks/related.json',()=>[{country:'BY',slug:'belarus',title:'Беларусь',sourceTravelIds:[169],pointIds:[2039],questIds:[42]}]);
jest.mock('@/components/books/bookCopy',()=>({useBookCopy:()=>((key:string)=>key)}));
jest.mock('@/utils/growthFunnelAnalytics',()=>({trackReadyBookRelatedOpened:jest.fn()}));

beforeEach(()=>{Object.defineProperty(Platform,'OS',{configurable:true,value:'web'});});
it('opens a selected-source book without activating the enclosing place card',()=>{
  const openPlace=jest.fn();
  render(<div onClick={openPlace}><ReadyBookRelatedLink sourceTravelId={169}/></div>);
  fireEvent.click(screen.getByRole('link'));
  expect(openPlace).not.toHaveBeenCalled();
  expect(screen.getByRole('link').getAttribute('href')).toBe('/books/belarus');
});
it('matches exact selected IDs and rejects unrelated sources and invalid IDs',()=>{
  for(const source of [{sourceTravelId:'169'},{pointId:2039},{questId:'42'}]){
    expect(relatedBookForSource(source)?.slug).toBe('belarus');
  }
  for(const source of [{},{sourceTravelId:170},{pointId:2040},{pointId:2040,sourceTravelId:169},{pointId:'invalid',sourceTravelId:169},{questId:43},{sourceTravelId:'169x'},{pointId:true},{sourceTravelId:Infinity}]){
    expect(relatedBookForSource(source)).toBeUndefined();
  }
});
it('hides the action when no exact association exists',()=>{
  render(<ReadyBookRelatedLink questId={43}/>);
  expect(screen.queryByRole('link')).toBeNull();
});
it('keeps a contextual place card from matching a thematic book through its source article',()=>{
  const view=render(<PlaceListCard title="Контекстная точка" relatedTravelId={169} sourcePointId={2040}/>);
  expect(screen.queryByRole('link')).toBeNull();
  view.rerender(<PlaceListCard title="Выбранное место" relatedTravelId={169} sourcePointId={2039}/>);
  const bookAction=screen.getByRole('link',{name:'explore: Беларусь'});
  expect(bookAction.getAttribute('href')).toBe('/books/belarus');
  expect(bookAction.getAttribute('title')).toBe('explore: Беларусь');
  expect(bookAction.textContent).toBe('');
  view.rerender(<PlaceListCard title="Точка без источника" relatedTravelId={169}/>);
  expect(screen.queryByRole('link')).toBeNull();
});
it('keeps the website-only book action off native surfaces',()=>{
  Object.defineProperty(Platform,'OS',{configurable:true,value:'ios'});
  render(<ReadyBookRelatedLink sourceTravelId={169}/>);
  expect(screen.queryByRole('link')).toBeNull();
});

it('lets the enclosing card ignore keyboard activation on the secondary action',()=>{
  const openPlace=jest.fn();
  render(<div onKeyDown={event=>{
    if(!(event.target as HTMLElement).closest('[data-card-action="true"]'))openPlace();
  }}><ReadyBookRelatedLink sourceTravelId={169}/></div>);
  const action=screen.getByRole('link');
  fireEvent.keyDown(action,{key:'Enter'});
  expect(action.getAttribute('data-card-action')).toBe('true');
  expect(openPlace).not.toHaveBeenCalled();
});

it('measures the contextual entry with its source and no personal data',()=>{
  const track=jest.mocked(trackReadyBookRelatedOpened);
  for(const [props,source] of [[{questId:42},'quest'],[{pointId:2039,sourceTravelId:169},'place'],[{sourceTravelId:169},'travel']] as const){
    track.mockClear();
    const view=render(<ReadyBookRelatedLink {...props}/>);
    fireEvent.click(screen.getByRole('link'));
    expect(track).toHaveBeenCalledWith(expect.objectContaining({slug:'belarus',country:'BY'}),source,expect.any(String));
    view.unmount();
  }
});
