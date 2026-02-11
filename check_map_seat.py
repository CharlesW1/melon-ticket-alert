import requests
import json
import time

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

# Optimized: Removed hardcoded Content-Length which can cause issues if body size changes
header = {
    'Accept': 'text/javascript, application/javascript, application/ecmascript, application/x-ecmascript, */*; q=0.01',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'Cookie': cookie,
    'Host': 'ticket.melon.com',
    'Referer': 'https://ticket.melon.com/reservation/popup/stepBlock.htm',
    'User-Agent': 'X'
}

def get_block_list(session) -> list:
    url = "https://ticket.melon.com/tktapi/product/getAreaMap.json?v=1&callback=getBlockGradeSeatMapCallBack" 
    
    body = {
        'prodId': prodId,
        'pocCode': pocCode,
        'scheduleNo': scheduleNo
    }
    
    # Optimized: Use session for connection reuse
    response = session.post(url, headers=header, data=body)
    block_datas = json.loads(response.text.replace("/**/getBlockGradeSeatMapCallBack(","").replace(");", "")) 
            
    return block_datas['seatData']['da']['sb']
    

def get_remain_seat_in_block(session, block) -> int:
    url = "https://ticket.melon.com/tktapi/product/seat/seatMapList.json?v=1&callback=getSeatListCallBack" 
   
    body = {
        'prodId': prodId,
        'pocCode': pocCode,
        'scheduleNo': scheduleNo,
        'blockId': block['sbid'], #getAreaMap.json > seatData > st > sbid
        'corpCodeNo': ''
    }

    # Optimized: Use session for connection reuse
    response = session.post(url, headers=header, data=body)
    map_datas = json.loads(response.text.replace("/**/getSeatListCallBack(","").replace(");", ""))
    count = 0
    
    # Optimized: Use sum() with generator expression for more efficient counting
    if "seatData" in map_datas and map_datas["seatData"].get("st"):
        count = sum(1 for st in map_datas['seatData']['st'][0].get('ss', []) if st.get('sid') is not None)
    
    return count

def send_message(session, message: str) -> None:
    # Optimized: Use session for connection reuse
    response = session.post(slack_webhook_url, json={'text' : message})

def main() -> None:
    # Optimized: Use requests.Session to reuse TCP connections, reducing handshake overhead
    with requests.Session() as session:
        # Optimized: Move get_block_list outside the loop since the block layout is static
        try:
            blocks = get_block_list(session)
        except Exception as e:
            print(f"Failed to get block list: {e}")
            return

        for i in range(30):
            for block in blocks:
                count = get_remain_seat_in_block(session, block)
                if count > 0:
                    send_message(session, block['sntv']['a'] + "구역에 잔여좌석 " + str(count) + "개 발생!")
            time.sleep(2)
        
if __name__ == "__main__":
    main()
