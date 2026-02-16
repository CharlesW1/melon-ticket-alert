import requests
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

def main() -> None:
    for i in range(30):
        seats = get_seats_summary()
        messages = check_remaining_seats(seats['summary'])
        send_message(messages)
        time.sleep(2)
        
def get_seats_summary() -> None:
    url = "https://ticket.melon.com/tktapi/product/summary.json?v=1" 
   
    body = {
        'prodId': prodId,
        'pocCode': pocCode,
        'scheduleNo': scheduleNo
    }

    header = {
        'Accept': 'text/javascript, application/javascript, application/ecmascript, application/x-ecmascript, */*; q=0.01',
        'Content-Length': '76',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Cookie': cookie,
        'Host': 'ticket.melon.com',
        'Referer': 'https://ticket.melon.com/reservation/popup/stepBlock.htm',
        'User-Agent': 'X'
    }

    response = requests.post(url,headers=header,data=body)
    return response.json()

def check_remaining_seats(seats: list) -> list:
    result = []
    
    for seat in seats:
        if seat['realSeatCntlk'] > 0:
            result.append(generate_message(seat))

    return result

def send_message(messages: list) -> None:
    for message in messages:
        response = requests.post(slack_webhook_url, json={'text' : message})
   
def generate_message(seat: dict) -> str: 
    message = ""
    message += seat['seatGradeName'] + ", " if 'seatGradeName' in seat else ""
    message += seat['floorNo'] if 'floorNo' in seat else ""
    message += seat['floorName'] +  " " if 'floorName' in seat else ""
    message += seat['areaNo'] if 'areaNo' in seat else ""
    message += seat['areaName'] if 'areaName' in seat else ""
    message += "에 잔여좌석 " + str(seat['realSeatCntlk']) + "개 발생! "
    return message

main()