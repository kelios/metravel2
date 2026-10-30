import React from 'react';
import {render,fireEvent,screen} from '@testing-library/react';
import {ReadyBookRelatedLink} from '@/components/books/ReadyBookRelatedLink';
import {relatedBookForSource} from '@/services/book/readyBooks/related';
import {Platform} from 'react-native';

jest.mock('react-native',()=>({Platform:{OS:'web'},Text:({children}:any)=><span>{children}</span>}));
jest.mock('expo-router',()=>({Link:({href,onPress,children,dataSet}:any)=><a href={href} onClick={onPress} data-card-action={dataSet?.cardAction}>{children}</a>}));
jest.mock('@/data/travelBooks/related.json',()=>[{country:'BY',slug:'belarus',title:'Беларусь',sourceTravelIds:[169],pointIds:[2039],questIds:[42]}]);
jest.mock('@/components/books/bookCopy',()=>({useBookCopy:()=>((key:string)=>key)}));

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
  for(const source of [{},{sourceTravelId:170},{pointId:2040},{questId:43},{sourceTravelId:'169x'},{pointId:true},{sourceTravelId:Infinity}]){
    expect(relatedBookForSource(source)).toBeUndefined();
  }
});
it('hides the action when no exact association exists',()=>{
  render(<ReadyBookRelatedLink questId={43}/>);
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
