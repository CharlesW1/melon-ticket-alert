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

melon_session = requests.Session()
melon_session.headers.update({
    'Accept': 'text/javascript, application/javascript, application/ecmascript, application/x-ecmascript, */*; q=0.01',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'Cookie': cookie,
    'Host': 'ticket.melon.com',
    'Referer': 'https://ticket.melon.com/reservation/popup/stepBlock.htm',
    'User-Agent': 'X'
})


def get_block_list() -> list:
    url = "https://ticket.melon.com/tktapi/product/getAreaMap.json?v=1&callback=getBlockGradeSeatMapCallBack"

    body = {
        'prodId': prodId,
        'pocCode': pocCode,
        'scheduleNo': scheduleNo
    }

    # Use melon_session for connection pooling to Melon Ticket API
    response = melon_session.post(url, data=body)
    block_datas = json.loads(response.text.replace("/**/getBlockGradeSeatMapCallBack(", "").replace(");", ""))

    return block_datas['seatData']['da']['sb']


def get_remain_seat_in_block(block) -> int:
    url = "https://ticket.melon.com/tktapi/product/seat/seatMapList.json?v=1&callback=getSeatListCallBack"

    body = {
        'prodId': prodId,
        'pocCode': pocCode,
        'scheduleNo': scheduleNo,
        'blockId': block['sbid'],  # getAreaMap.json > seatData > st > sbid
        'corpCodeNo': ''
    }

    # Use melon_session for connection pooling to Melon Ticket API
    response = melon_session.post(url, data=body)
    map_datas = json.loads(response.text.replace("/**/getSeatListCallBack(", "").replace(");", ""))
    count = 0

    if "seatData" in map_datas:
        for st in map_datas['seatData']['st'][0]['ss']:
            if st['sid'] is not None:
                count += 1

    return count


def send_message(message: str) -> None:
    # Do NOT use melon_session for Slack to avoid leaking headers/cookies and causing Host header conflicts
    requests.post(slack_webhook_url, json={'text': message})


def main() -> None:
    # Fetch block list once outside the loop as it is static data (hoisting)
    try:
        blocks = get_block_list()
    except Exception as e:
        print(f"Error fetching block list: {e}")
        return

    for i in range(30):
        for block in blocks:
            count = get_remain_seat_in_block(block)
            if count > 0:
                send_message(block['sntv']['a'] + "구역에 잔여좌석 " + str(count) + "개 발생!")
        time.sleep(2)


if __name__ == "__main__":
    main()