import requests
import json
import time
from concurrent.futures import ThreadPoolExecutor

#######################################################
########### 아래 값 채워준 뒤 실행해주시면 됩니다. #############
#######################################################
prodId = ""
pocCode = ""
scheduleNo = ""
cookie = ""
slack_webhook_url = ""
#######################################################
#######################################################

# Bolt: Hoisted headers for clarity and reuse.
MELON_HEADERS = {
    'Accept': 'text/javascript, application/javascript, application/ecmascript, application/x-ecmascript, */*; q=0.01',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'Cookie': cookie,
    'Host': 'ticket.melon.com',
    'Referer': 'https://ticket.melon.com/reservation/popup/stepBlock.htm',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

def get_block_list(session: requests.Session) -> list:
    url = "https://ticket.melon.com/tktapi/product/getAreaMap.json?v=1&callback=getBlockGradeSeatMapCallBack" 
    
    body = {
        'prodId': prodId,
        'pocCode': pocCode,
        'scheduleNo': scheduleNo
    }
    
    # Bolt: Reusing session for connection pooling (Keep-Alive)
    response = session.post(url, headers=MELON_HEADERS, data=body)
    text = response.text.replace("/**/getBlockGradeSeatMapCallBack(", "").replace(");", "")
    block_datas = json.loads(text)
            
    return block_datas['seatData']['da']['sb']
    

def get_remain_seat_in_block(session: requests.Session, block: dict) -> int:
    url = "https://ticket.melon.com/tktapi/product/seat/seatMapList.json?v=1&callback=getSeatListCallBack" 
   
    body = {
        'prodId': prodId,
        'pocCode': pocCode,
        'scheduleNo': scheduleNo,
        'blockId': block['sbid'], #getAreaMap.json > seatData > st > sbid
        'corpCodeNo': ''
    }

    # Bolt: Reusing session for connection pooling
    response = session.post(url, headers=MELON_HEADERS, data=body)
    text = response.text.replace("/**/getSeatListCallBack(", "").replace(");", "")
    map_datas = json.loads(text)
    
    count = 0
    if "seatData" in map_datas:
        # Bolt: Optimized seat counting with generator expression
        seats = map_datas['seatData']['st'][0]['ss']
        count = sum(1 for st in seats if st.get('sid') is not None)
    
    return count

def send_message(message: str) -> None:
    # Bolt: Slack notifications use a separate requests.post to avoid session header pollution (like 'Host')
    if not slack_webhook_url:
        print(f"Slack URL not set. Message: {message}")
        return
    try:
        requests.post(slack_webhook_url, json={'text': message}, timeout=5)
    except Exception as e:
        print(f"Failed to send Slack message: {e}")

def check_block_and_notify(session: requests.Session, block: dict) -> None:
    try:
        count = get_remain_seat_in_block(session, block)
        if count > 0:
            area_name = block.get('sntv', {}).get('a', '알 수 없음')
            send_message(f"{area_name}구역에 잔여좌석 {count}개 발생!")
    except Exception as e:
        print(f"Error checking block {block.get('sbid')}: {e}")

def main() -> None:
    # Bolt: Use requests.Session for connection reuse
    with requests.Session() as session:
        # Bolt: Hoist block list fetching out of the loop to avoid redundant API calls
        try:
            blocks = get_block_list(session)
        except Exception as e:
            print(f"Error fetching block list: {e}")
            return

        print(f"Starting monitor for {len(blocks)} blocks...")

        # Bolt: Instantiate the pool once outside the loop to avoid thread creation overhead
        with ThreadPoolExecutor(max_workers=10) as executor:
            for i in range(30):
                start_time = time.time()

                # Bolt: Parallelize block checking
                futures = [executor.submit(check_block_and_notify, session, block) for block in blocks]

                # Wait for all checks in this iteration to finish
                for future in futures:
                    future.result()

                elapsed = time.time() - start_time
                print(f"Iteration {i+1} took {elapsed:.2f}s")

                # Maintain interval between iterations
                if i < 29:
                    time.sleep(max(0, 2 - elapsed))

if __name__ == "__main__":
    main()
